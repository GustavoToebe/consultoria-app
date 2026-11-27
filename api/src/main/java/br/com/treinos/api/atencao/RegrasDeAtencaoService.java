package br.com.treinos.api.atencao;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.Escala;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.PerguntaDisponivel;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.QuestionarioDaPergunta;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.Regra;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.RegraRequest;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.RegrasDeAtencao;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.SalvarRequest;
import br.com.treinos.api.atualizacoes.ValidadorAtualizacao;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.questionarios.Finalidade;
import br.com.treinos.api.questionarios.Questionario;
import br.com.treinos.api.questionarios.QuestionarioRepository;
import br.com.treinos.api.questionarios.QuestionarioResolver;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Regras de atenção da consultoria (C1 e C2): ler a lista com as perguntas que se podem escolher e salvar a lista inteira de uma
 * vez. As mensagens são fixas e nunca repetem o valor; a auditoria tem resumo fixo, uma linha por regra que muda.
 */
@Service
public class RegrasDeAtencaoService {

    /** No máximo 50 regras por consultoria, conferido com a consultoria travada (como tags e vitrine). */
    public static final int TETO = 50;
    private static final String CODIGO = "REGRA_INVALIDA";

    private final RegraDeAtencaoRepository regras;
    private final ExcecaoDoAlunoRepository excecoes;
    private final ConsultoriaRepository consultorias;
    private final QuestionarioRepository questionarios;
    private final QuestionarioResolver resolver;
    private final Auditoria auditoria;
    private final JsonMapper json;

    public RegrasDeAtencaoService(RegraDeAtencaoRepository regras, ExcecaoDoAlunoRepository excecoes, ConsultoriaRepository consultorias,
            QuestionarioRepository questionarios, QuestionarioResolver resolver, Auditoria auditoria, JsonMapper json) {
        this.regras = regras;
        this.excecoes = excecoes;
        this.consultorias = consultorias;
        this.questionarios = questionarios;
        this.resolver = resolver;
        this.auditoria = auditoria;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public RegrasDeAtencao listar() {
        return resposta(regras.findAllByOrderByCriadoEmAscIdAsc(), perguntas());
    }

    /**
     * Substitui a lista inteira. Ordem das recusas: {@code versao} ausente ou velha 409 {@code CONFLITO_EDICAO}; {@code id} que não é
     * desta consultoria 404; corpo acima do teto ou regra inválida 422 {@code REGRA_INVALIDA} com {@code fieldErrors} em
     * {@code regras[i].tipo|perguntaId|limite}. A pergunta e a faixa só são conferidas na regra nova ou quando mudam (arquivar um
     * questionário não trava o resto da lista). Nada mudou = 200 sem gravar nem auditar.
     */
    @Transactional
    public RegrasDeAtencao salvar(SalvarRequest r) {
        if (consultorias.travar(TenantContext.get()).isEmpty()) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
        List<RegraDeAtencao> atuais = regras.findAllByOrderByCriadoEmAscIdAsc();
        if (r.versao() == null || r.versao() != versao(atuais)) {
            throw conflito();
        }
        List<RegraRequest> pedidas = r.regras();
        if (pedidas.size() > TETO) {
            throw invalida(List.of(new ApiError.FieldError("regras", "Use até " + TETO + " regras.")));
        }
        Map<UUID, RegraDeAtencao> porId = atuais.stream().collect(Collectors.toMap(RegraDeAtencao::getId, Function.identity()));
        Map<String, PerguntaDisponivel> disponiveis = null;
        List<ApiError.FieldError> problemas = new ArrayList<>();
        List<Pedida> validas = new ArrayList<>();
        Set<String> chaves = new HashSet<>();
        Set<UUID> ids = new HashSet<>();
        for (int i = 0; i < pedidas.size(); i++) {
            String campo = "regras[" + i + "]";
            RegraRequest p = pedidas.get(i);
            if (p == null) {
                problemas.add(new ApiError.FieldError(campo, "Regra inválida."));
                continue;
            }
            RegraDeAtencao existente = null;
            if (p.id() != null) {
                existente = porId.get(p.id());
                if (existente == null) {
                    throw new NaoEncontradoException("Regra não encontrada.");
                }
                if (!ids.add(p.id())) {
                    problemas.add(new ApiError.FieldError(campo + ".id", "A mesma regra apareceu duas vezes."));
                    continue;
                }
            }
            TipoDeRegra tipo = TipoDeRegra.ler(p.tipo()).orElse(null);
            if (tipo == null) {
                problemas.add(new ApiError.FieldError(campo + ".tipo", "Escolha um dos modelos de regra."));
                continue;
            }
            if (existente != null && existente.getTipo() != tipo) {
                problemas.add(new ApiError.FieldError(campo + ".tipo", "O modelo de uma regra não muda; apague e crie outra."));
                continue;
            }
            String pergunta = tipo.temPergunta() && p.perguntaId() != null && !p.perguntaId().isBlank() ? p.perguntaId().strip() : null;
            BigDecimal limite = tipo.temLimite() ? p.limite() : null;
            boolean perguntaMudou = existente == null || !java.util.Objects.equals(existente.getPerguntaId(), pergunta);
            boolean limiteMudou = existente == null || !RegraDeAtencao.mesmoNumero(existente.getLimite(), limite);
            PerguntaDisponivel disponivel = null;
            if (tipo.temPergunta() && (perguntaMudou || limiteMudou) && pergunta != null) {
                if (disponiveis == null) {
                    disponiveis = perguntas().stream().collect(Collectors.toMap(d -> d.perguntaId() + "|" + d.tipo(), Function.identity()));
                }
                disponivel = disponiveis.get(pergunta + "|" + tipo.tipoDaPergunta());
            }
            boolean ok = true;
            if (tipo.temPergunta()) {
                if (pergunta == null) {
                    problemas.add(new ApiError.FieldError(campo + ".perguntaId", "Escolha a pergunta."));
                    ok = false;
                } else if (perguntaMudou && disponivel == null) {
                    problemas.add(new ApiError.FieldError(campo + ".perguntaId",
                            "Escolha uma pergunta de um questionário de atualização publicado."));
                    ok = false;
                }
            }
            if (tipo.temLimite()) {
                String erro = limite == null ? "Informe o número." : (limiteMudou || perguntaMudou) ? erroDoLimite(tipo, limite, disponivel) : null;
                if (erro != null) {
                    problemas.add(new ApiError.FieldError(campo + ".limite", erro));
                    ok = false;
                }
            }
            if (ok && !chaves.add(tipo + "|" + pergunta)) {
                problemas.add(new ApiError.FieldError(campo + (tipo.temPergunta() ? ".perguntaId" : ".tipo"), "Já existe uma regra igual."));
                ok = false;
            }
            if (ok) {
                validas.add(new Pedida(existente, tipo, pergunta, limite == null ? null : limite.setScale(1, RoundingMode.UNNECESSARY),
                        p.ativa() == null || p.ativa()));
            }
        }
        if (!problemas.isEmpty()) {
            throw invalida(problemas);
        }
        gravar(atuais, validas);
        return resposta(regras.findAllByOrderByCriadoEmAscIdAsc(), perguntas());
    }

    private record Pedida(RegraDeAtencao existente, TipoDeRegra tipo, String perguntaId, BigDecimal limite, boolean ativa) { }

    /** Apaga primeiro, depois altera, depois cria (cada passo com flush), para o índice único não ver o estado no meio. */
    private void gravar(List<RegraDeAtencao> atuais, List<Pedida> validas) {
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Set<RegraDeAtencao> ficam = new HashSet<>();
        validas.stream().map(Pedida::existente).filter(java.util.Objects::nonNull).forEach(ficam::add);
        try {
            for (RegraDeAtencao r : atuais) {
                if (!ficam.contains(r)) {
                    regras.delete(r);
                    auditoria.registrarEvento("REGRA_ATENCAO_REMOVIDA", "REGRA_ATENCAO", r.getId(), "Removeu uma regra de atenção.");
                }
            }
            regras.flush();
            for (Pedida p : validas) {
                if (p.existente() != null && p.existente().alterar(p.perguntaId(), p.limite(), p.ativa(), agora)) {
                    auditoria.registrarEvento("REGRA_ATENCAO_ALTERADA", "REGRA_ATENCAO", p.existente().getId(), "Alterou uma regra de atenção.");
                }
            }
            regras.flush();
            for (Pedida p : validas) {
                if (p.existente() == null) {
                    RegraDeAtencao nova = regras.save(new RegraDeAtencao(p.tipo(), p.perguntaId(), p.limite(), p.ativa(), agora));
                    auditoria.registrarEvento("REGRA_ATENCAO_CRIADA", "REGRA_ATENCAO", nova.getId(), "Criou uma regra de atenção.");
                }
            }
            regras.flush();
        } catch (ObjectOptimisticLockingFailureException e) {
            throw conflito();
        } catch (DataIntegrityViolationException e) {
            // Só a troca de perguntas entre duas regras no mesmo salvar chega aqui (o repetido no corpo já foi recusado).
            if (violou(e, "ux_regra_atencao_tipo_pergunta")) {
                throw invalida(List.of(new ApiError.FieldError("regras", "Salve a troca de perguntas em duas vezes.")));
            }
            throw e;
        }
    }

    /** Faixa do número por modelo (C3); a mensagem diz a faixa, nunca o valor digitado. */
    static String erroDoLimite(TipoDeRegra tipo, BigDecimal limite, PerguntaDisponivel pergunta) {
        boolean inteiro = limite.stripTrailingZeros().scale() <= 0;
        return switch (tipo) {
            case NOTA_ABAIXO -> {
                int min = pergunta == null || pergunta.escala() == null ? 0 : pergunta.escala().min();
                int max = pergunta == null || pergunta.escala() == null ? 10 : pergunta.escala().max();
                yield inteiro && dentro(limite, min, max) ? null : "Use um número inteiro de " + min + " a " + max + ".";
            }
            case NOTA_CAIU -> inteiro && dentro(limite, 1, 10) ? null : "Use um número inteiro de 1 a 10.";
            case POUCOS_TREINOS -> inteiro && dentro(limite, 1, 31) ? null : "Use um número inteiro de 1 a 31.";
            case PESO_MUDOU -> limite.stripTrailingZeros().scale() <= 1 && limite.compareTo(new BigDecimal("0.1")) >= 0
                    && limite.compareTo(BigDecimal.valueOf(50)) <= 0 ? null : "Use de 0,1 a 50 kg, com até uma casa decimal.";
            case SIM, ITEM_MARCADO -> null;
        };
    }

    private static boolean dentro(BigDecimal v, int min, int max) {
        return v.compareTo(BigDecimal.valueOf(min)) >= 0 && v.compareTo(BigDecimal.valueOf(max)) <= 0;
    }

    /**
     * Perguntas NOTA, SIM_NAO e ITENS_DO_PLANO da última versão publicada dos questionários de atualização ativos, agrupadas por id e
     * tipo (o padrão primeiro, depois por nome). Rótulo do primeiro questionário em que aparece.
     */
    public List<PerguntaDisponivel> perguntas() {
        Map<String, PerguntaDisponivel> porChave = new LinkedHashMap<>();
        List<Questionario> usaveis = questionarios.findByArquivadoAndFinalidadeOrderByNomeAsc(false, Finalidade.ATUALIZACAO).stream()
                .filter(Questionario::isUsavel).sorted(Comparator.comparing((Questionario q) -> !q.isPadrao())).toList();
        for (Questionario q : usaveis) {
            JsonNode conteudo = json.readTree(resolver.publicada(q).conteudo());
            for (JsonNode secao : conteudo.path("secoes")) {
                for (JsonNode p : secao.path("perguntas")) {
                    String tipo = p.path("tipo").isString() ? p.path("tipo").stringValue() : "";
                    if (!List.of("NOTA", "SIM_NAO", "ITENS_DO_PLANO").contains(tipo) || !p.path("id").isString()) {
                        continue;
                    }
                    String id = p.path("id").stringValue();
                    String rotulo = p.path("rotulo").isString() ? p.path("rotulo").stringValue().strip() : "";
                    int[] e = "NOTA".equals(tipo) ? ValidadorAtualizacao.escalaDaNota(p) : null;
                    var deste = new QuestionarioDaPergunta(q.getId(), q.getNome());
                    porChave.merge(id + "|" + tipo, new PerguntaDisponivel(id, tipo, rotulo, e == null ? null : new Escala(e[0], e[1]),
                            List.of(deste)), RegrasDeAtencaoService::juntar);
                }
            }
        }
        return List.copyOf(porChave.values());
    }

    /** A mesma pergunta em outro questionário (ou repetida no mesmo): rótulo do primeiro, união das escalas, questionário uma vez só. */
    private static PerguntaDisponivel juntar(PerguntaDisponivel a, PerguntaDisponivel b) {
        Escala escala = a.escala() == null || b.escala() == null ? a.escala()
                : new Escala(Math.min(a.escala().min(), b.escala().min()), Math.max(a.escala().max(), b.escala().max()));
        List<QuestionarioDaPergunta> qs = new ArrayList<>(a.questionarios());
        b.questionarios().stream().filter(x -> qs.stream().noneMatch(y -> y.id().equals(x.id()))).forEach(qs::add);
        return new PerguntaDisponivel(a.perguntaId(), a.tipo(), a.rotulo(), escala, List.copyOf(qs));
    }

    private RegrasDeAtencao resposta(List<RegraDeAtencao> linhas, List<PerguntaDisponivel> perguntas) {
        // Etapa 2: só a contagem de alunos com exceção em cada regra, numa consulta agrupada.
        Map<UUID, Long> comExcecao = excecoes.contagens().stream()
                .collect(Collectors.toMap(ExcecaoDoAlunoRepository.Contagem::getRegraId, ExcecaoDoAlunoRepository.Contagem::getAlunos));
        List<Regra> lista = linhas.stream().map(r -> new Regra(r.getId(), r.getTipo().name(), r.getPerguntaId(), r.getLimite(),
                r.isAtiva(), comExcecao.getOrDefault(r.getId(), 0L))).toList();
        return new RegrasDeAtencao(versao(linhas), TETO, perguntas, lista);
    }

    /**
     * A versão da lista: impressão dos pares (id, versão da linha) de todas as regras, em 52 bits (inteiro seguro no JavaScript).
     * Muda quando uma regra entra, sai ou é alterada; igual quando nada mudou. Sem coluna nova: a {@code consultoria} tem
     * {@code @Version} próprio e não pode subir por isto.
     */
    static long versao(List<RegraDeAtencao> linhas) {
        String impressao = linhas.stream().sorted(Comparator.comparing(RegraDeAtencao::getId))
                .map(r -> r.getId() + ":" + r.getVersao()).collect(Collectors.joining(";"));
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(impressao.getBytes(StandardCharsets.UTF_8));
            long v = 0;
            for (int i = 0; i < 8; i++) {
                v = (v << 8) | (h[i] & 0xFF);
            }
            return v & 0x000F_FFFF_FFFF_FFFFL;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }

    private static boolean violou(DataIntegrityViolationException e, String restricao) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && restricao.equals(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }

    private static ValidacaoException invalida(List<ApiError.FieldError> problemas) {
        return new ValidacaoException("Confira as regras.", CODIGO, problemas);
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou as regras. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }
}
