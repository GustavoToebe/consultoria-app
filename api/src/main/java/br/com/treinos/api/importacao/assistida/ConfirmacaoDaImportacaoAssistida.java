package br.com.treinos.api.importacao.assistida;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ApiException;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDieta;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.Importacao;
import br.com.treinos.api.importacao.ImportacaoRepository;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.AlunoGravado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CadastroImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmacaoResultado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.PesoImportavel;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.receitas.Receita;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.web.ConflitoComRecursoException;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Gravação dos grupos revisados da importação assistida. Sem {@code @Transactional} no topo, de propósito: exceção de
 * bean transacional (o {@link AlunoService}, o {@link ReceitaService}) marca a transação como "só rollback", então cada
 * grupo roda numa transação própria e a falha de um não contamina os outros.
 *
 * <p>Ordem: (1) confere a sessão e as permissões de todos os grupos escolhidos, antes de qualquer efeito (403 e nada
 * muda); (2) um grupo por transação: valida tudo antes de gravar, grava, e troca o grupo pelo esqueleto sem dado pessoal;
 * grupo que falha volta atrás sozinho e fica {@code ERRO} com um código fixo (nunca a mensagem da exceção); (3) fecha a
 * sessão, audita uma vez ({@code IMPORTACAO_ASSISTIDA_CONCLUIDA}, resumo fixo) e deixa uma linha no histórico das
 * importações ({@code importacao}, destino {@code assistida}, sem nome de arquivo nem dado do aluno).
 *
 * <p>Aluno novo nasce pelo {@link AlunoService#criar} (plano, limite do treinador, CPF e auditoria {@code ALUNO_CRIADO});
 * vincular exige um aluno da consultoria, ativo e não anonimizado. Treino e dieta entram só em rascunho; nada é publicado.
 */
@Service
public class ConfirmacaoDaImportacaoAssistida {

    static final int NOME_DO_ALUNO = 120;
    static final String NOME_PENDENTE = "Informe o nome do aluno, vincule a um existente ou ignore.";
    static final int OBJETIVO_DO_ALUNO = 200;
    static final int OBSERVACOES_DO_ALUNO = 4000;
    static final String TITULO_DA_PASTA = "Plano Atual (Importado)";
    /** Destino da linha no histórico das importações ({@code importacao.destino}, sem CHECK no banco). */
    static final String DESTINO_NO_HISTORICO = "assistida";
    private static final int TITULO_DO_PLANO = 120;
    private static final BigDecimal PESO_MAXIMO = BigDecimal.valueOf(500);
    private static final Pattern CODIGO_FIXO = Pattern.compile("[A-Z][A-Z0-9_]{0,63}");
    private static final Pattern EMAIL_SIMPLES = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    private final ImportacaoSessaoRepository sessoes;
    private final ImportacaoArquivoRepository arquivos;
    private final JsonMapper json;
    private final AlunoService alunoService;
    private final AlunoRepository alunos;
    private final ConsultoriaRepository consultorias;
    private final RegistroPesoRepository pesos;
    private final PastaRepository pastas;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final ReceitaService receitas;
    private final Auditoria auditoria;
    private final ImportacaoRepository historico;
    private final TransactionTemplate transacao;

    public ConfirmacaoDaImportacaoAssistida(ImportacaoSessaoRepository sessoes, ImportacaoArquivoRepository arquivos,
                                            JsonMapper json, AlunoService alunoService,
                                            AlunoRepository alunos, ConsultoriaRepository consultorias,
                                            RegistroPesoRepository pesos, PastaRepository pastas,
                                            PlanoTreinoRepository treinos, PlanoDietaRepository dietas,
                                            ReceitaService receitas, Auditoria auditoria,
                                            ImportacaoRepository historico, PlatformTransactionManager transacoes) {
        this.sessoes = sessoes;
        this.arquivos = arquivos;
        this.json = json;
        this.alunoService = alunoService;
        this.alunos = alunos;
        this.consultorias = consultorias;
        this.pesos = pesos;
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.receitas = receitas;
        this.auditoria = auditoria;
        this.historico = historico;
        this.transacao = new TransactionTemplate(transacoes);
    }

    /** O que uma gravação de grupo produziu; somado no fim para a resposta. {@code aluno} nulo no modelo. */
    private record Gravado(int alunosCriados, int alunosVinculados, int treinos, int dietas, int modelos, int pesosGravados,
                           int pesosIgnorados, boolean gravou, AlunoGravado aluno) {
        static final Gravado NADA = new Gravado(0, 0, 0, 0, 0, 0, 0, false, null);
    }

    private record PreparoConfirmacao(List<String> gruposIds, String hashPedido, ConfirmacaoResultado resultadoIdempotente) {
    }

    public ConfirmacaoResultado confirmar(UUID sessaoId, UUID usuarioId, ConfirmarSessaoRequisicao req) {
        if (req.gruposIds() == null || req.gruposIds().isEmpty()) {
            throw new BadRequestException("Selecione ao menos um grupo para confirmar.", "SELECAO_VAZIA");
        }
        if (req.gruposIds().stream().anyMatch(id -> id == null || id.isBlank())
                || new HashSet<>(req.gruposIds()).size() != req.gruposIds().size()) {
            throw new BadRequestException("Seleção de grupos inválida.", "SELECAO_INVALIDA");
        }
        if (req.chaveIdempotencia() == null || req.chaveIdempotencia().isBlank()) {
            throw new BadRequestException("Chave de idempotência obrigatória.", "CHAVE_IDEMPOTENCIA_OBRIGATORIA");
        }

        PreparoConfirmacao preparo = transacao.execute(status -> prepararEscolha(sessaoId, req));
        if (preparo != null && preparo.resultadoIdempotente() != null) {
            ConfirmacaoResultado salvo = preparo.resultadoIdempotente();
            return transacao.execute(status -> salvo.comAlunos(comNomes(salvo.alunos())));
        }
        List<String> escolhidos = preparo != null ? preparo.gruposIds() : List.of();

        int importados = 0;
        int criados = 0;
        int vinculados = 0;
        int treinosCriados = 0;
        int dietasCriadas = 0;
        int modelos = 0;
        int comErro = 0;
        int pesosGravados = 0;
        int pesosIgnorados = 0;
        List<AlunoGravado> gravados = new ArrayList<>();
        for (String grupoId : escolhidos) {
            try {
                Gravado g = transacao.execute(status -> gravarGrupo(sessaoId, grupoId, usuarioId));
                if (g != null && g.gravou()) {
                    if (g.aluno() != null) {
                        gravados.add(g.aluno());
                    }
                    importados++;
                    criados += g.alunosCriados();
                    vinculados += g.alunosVinculados();
                    treinosCriados += g.treinos();
                    dietasCriadas += g.dietas();
                    modelos += g.modelos();
                    pesosGravados += g.pesosGravados();
                    pesosIgnorados += g.pesosIgnorados();
                }
            } catch (RuntimeException e) {
                comErro++;
                String codigo = codigoDe(e);
                transacao.executeWithoutResult(status -> marcarErro(sessaoId, grupoId, codigo));
            }
        }
        int totalImportados = importados;
        String situacao = comErro == 0 ? "CONCLUIDA" : importados == 0 ? "FALHOU" : "CONCLUIDA_COM_ERROS";
        // Na sessão (repetição idempotente) só os ids: o nome do aluno não fica guardado nela.
        ConfirmacaoResultado resultado = new ConfirmacaoResultado(sessaoId, situacao, importados, criados, vinculados,
                treinosCriados, dietasCriadas, modelos, comErro, pesosGravados, pesosIgnorados,
                gravados.stream().map(a -> a.comNome(null)).toList());
        String hashPedido = preparo != null ? preparo.hashPedido() : null;
        transacao.executeWithoutResult(status -> fechar(sessaoId, usuarioId, totalImportados,
                req.chaveIdempotencia().strip(), hashPedido, resultado));
        return resultado.comAlunos(AcessoAtual.pode("ALUNO_LER") ? gravados : List.of());
    }

    /**
     * Nomes (chave sem acento nem caixa) dos alunos que esta sessão já criou de grupo com nome lido do conteúdo (só eles
     * entram em {@code alunosCriados}), em qualquer confirmação: o grupo já virou
     * esqueleto, o progresso guarda só o id (gravado na transação que criou o aluno) e o nome vem do cadastro. Lido sob a
     * trava da sessão, então duas confirmações ao mesmo tempo (chaves diferentes) se enxergam. JSON ilegível lança (falha
     * fechada: o grupo fica com erro em vez de criar um aluno repetido).
     */
    private Set<String> nomesJaCriados(ImportacaoSessao sessao) {
        List<UUID> ids = SessaoJson.alunosCriados(json, sessao);
        Set<String> nomes = new HashSet<>();
        alunos.findAllById(ids).forEach(a -> nomes.add(ImportacaoAssistidaService.chaveDoNome(a.getNome())));
        return nomes;
    }

    /** Os alunos da resposta só com {@code ALUNO_LER}, com o nome atual lido do banco (o guardado não tem nome). */
    private List<AlunoGravado> comNomes(List<AlunoGravado> lista) {
        if (!AcessoAtual.pode("ALUNO_LER") || lista.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> nomes = new HashMap<>();
        alunos.findAllById(lista.stream().map(AlunoGravado::alunoId).toList())
                .forEach(a -> nomes.put(a.getId(), a.getNome()));
        return lista.stream().map(a -> a.comNome(nomes.get(a.alunoId()))).toList();
    }

    // ------------------------------------------------------------------------------------------------ fase 1

    /** Sessão (404 de outra consultoria), idempotência, revisão, hashPrevia, estado, escolha dos grupos e permissões: nada é gravado aqui. */
    private PreparoConfirmacao prepararEscolha(UUID sessaoId, ConfirmarSessaoRequisicao req) {
        ImportacaoSessao sessao = sessoes.buscarParaAlterar(sessaoId, TenantContext.get())
                .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
        String chave = req.chaveIdempotencia().strip();
        String hashPedido = HashPreviaImportacao.hashPedido(req.revisaoEsperada(), req.hashPrevia(), req.gruposIds());
        ConfirmacaoResultado jaSalvo = verificarIdempotencia(sessao, chave, hashPedido);
        if (jaSalvo != null) {
            return new PreparoConfirmacao(List.of(), hashPedido, jaSalvo);
        }
        String estadoAtual = SessaoJson.estadoEfetivo(json, sessao);
        if ("CANCELADA".equals(estadoAtual)) {
            throw new ConflictException("A importação foi cancelada.", "SESSAO_CANCELADA");
        }
        if ("CONCLUIDA".equals(estadoAtual)) {
            throw new ConflictException("A importação já foi concluída.", "SESSAO_CONCLUIDA");
        }
        if ("EXPIRADA".equals(estadoAtual) || sessao.getExpiraEm().isBefore(Instant.now())) {
            throw new ConflictException("A importação expirou.", "SESSAO_EXPIRADA");
        }
        if (!"REVISANDO".equals(estadoAtual)) {
            throw new ConflictException("Processe os arquivos antes de confirmar.", "SESSAO_NAO_PROCESSADA");
        }
        if (req.revisaoEsperada() != sessao.getRevisao()) {
            throw new ConflictException("A importação mudou desde a sua revisão. Recarregue e confira de novo.",
                    "CONFLITO_EDICAO");
        }
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        String hashAtual = HashPreviaImportacao.calcular(sessao, grupos);
        if (req.hashPrevia() == null || !req.hashPrevia().equals(hashAtual)) {
            throw new ConflictException("A prévia mudou desde o carregamento. Recarregue e confira de novo.",
                    "PREVIA_DESATUALIZADA");
        }
        List<GrupoImportavel> escolhidos = new ArrayList<>();
        for (String id : req.gruposIds()) {
            GrupoImportavel g = grupos.stream().filter(x -> x.id().equals(id)).findFirst()
                    .orElseThrow(() -> new BadRequestException("Grupo não encontrado na sessão.", "SELECAO_INVALIDA"));
            if (!pendente(g)) {
                throw new BadRequestException("Alguns grupos selecionados já foram gravados ou ignorados.", "SELECAO_INVALIDA");
            }
            escolhidos.add(g);
        }
        escolhidos.forEach(ConfirmacaoDaImportacaoAssistida::exigirPermissoes);
        exigirNomeDosAlunosNovos(escolhidos);
        return new PreparoConfirmacao(escolhidos.stream().map(GrupoImportavel::id).toList(), hashPedido, null);
    }

    /**
     * Aluno novo com o nome substituto ("Aluno 3", o nome do arquivo) nasceria com esse nome e ocuparia vaga do plano:
     * 422 {@code NOME_DO_ALUNO_PENDENTE} com um erro por grupo ({@code grupos.<id>.nome}), antes de qualquer efeito. Dar
     * o nome ({@code PUT} do grupo), vincular a um aluno existente, salvar como modelo ou ignorar destravam.
     */
    private static void exigirNomeDosAlunosNovos(List<GrupoImportavel> escolhidos) {
        List<ApiError.FieldError> semNome = escolhidos.stream().filter(ConfirmacaoDaImportacaoAssistida::semNomeParaCriar)
                .map(g -> new ApiError.FieldError("grupos." + g.id() + ".nome", NOME_PENDENTE)).toList();
        if (!semNome.isEmpty()) {
            throw new ValidacaoException(NOME_PENDENTE, "NOME_DO_ALUNO_PENDENTE", semNome);
        }
    }

    private static boolean semNomeParaCriar(GrupoImportavel g) {
        return "CRIAR_ALUNO".equals(g.destino()) && g.nomeSubstituto();
    }

    private ConfirmacaoResultado verificarIdempotencia(ImportacaoSessao sessao, String chave, String hashPedido) {
        String raw = sessao.getProgressoJson();
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            JsonNode root = json.readTree(raw);
            JsonNode confs = root.get("confirmacoes");
            if (confs == null || !confs.has(chave)) {
                return null;
            }
            JsonNode entrada = confs.get(chave);
            String hashSalvo = entrada.hasNonNull("hashPedido") ? entrada.get("hashPedido").asString() : "";
            if (!hashPedido.equals(hashSalvo)) {
                throw new ConflictException("Chave de idempotência já utilizada com dados diferentes.",
                        "IDEMPOTENCIA_CONFLITANTE");
            }
            return json.treeToValue(entrada.get("resultado"), ConfirmacaoResultado.class);
        } catch (ConflictException e) {
            throw e;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean pendente(GrupoImportavel g) {
        return !"IMPORTADO".equals(g.estado()) && !"IGNORAR".equals(g.destino());
    }

    /**
     * Cada parte do grupo pede a permissão da rota que a grava, como no resto da API: aluno = {@code ALUNO_ALTERAR};
     * peso, objetivo e observações = {@code ALUNO_SENSIVEL_ALTERAR}; treino = {@code TREINO_ALTERAR} + {@code PASTA_ALTERAR};
     * dieta = {@code DIETA_ALTERAR} + {@code PASTA_ALTERAR}; modelo = {@code MODELO_ALTERAR}.
     */
    private static void exigirPermissoes(GrupoImportavel g) {
        if ("MODELO_BIBLIOTECA".equals(g.destino())) {
            AcessoAtual.exigir("MODELO_ALTERAR");
            return;
        }
        AcessoAtual.exigir("ALUNO_ALTERAR");
        CadastroImportavel c = g.cadastro();
        boolean sensivel = (c != null && (temTexto(c.objetivo()) || temTexto(c.observacoes())))
                || (g.pesos() != null && !g.pesos().isEmpty());
        if (sensivel) {
            AcessoAtual.exigir("ALUNO_SENSIVEL_ALTERAR");
        }
        if (g.treino() != null) {
            AcessoAtual.exigir("TREINO_ALTERAR");
            AcessoAtual.exigir("PASTA_ALTERAR");
        }
        if (g.dieta() != null) {
            AcessoAtual.exigir("DIETA_ALTERAR");
            AcessoAtual.exigir("PASTA_ALTERAR");
        }
    }

    // ------------------------------------------------------------------------------------------------ fase 2

    /**
     * Um grupo, numa transação: trava a sessão, valida tudo, grava e troca o grupo pelo esqueleto. O aluno criado entra
     * no progresso ({@code alunosCriados}) nesta mesma transação: a próxima confirmação, mesmo com outra chave e ao mesmo
     * tempo, já o vê ao pegar a trava.
     *
     * <p>A trava por nome ({@code MESMO_NOME_NA_SESSAO}) só vale para o nome lido do conteúdo: homônimo na consultoria é
     * permitido (só e-mail e CPF travam), e o substituto (nome do arquivo, título do texto, "Aluno N") não identifica
     * ninguém; ali o "um aluno só" é o próprio grupo, que passa a {@code IMPORTADO} nesta transação.
     */
    private Gravado gravarGrupo(UUID sessaoId, String grupoId, UUID usuarioId) {
        ImportacaoSessao sessao = sessoes.buscarParaAlterar(sessaoId, TenantContext.get())
                .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        GrupoImportavel g = grupos.stream().filter(x -> x.id().equals(grupoId)).findFirst()
                .orElseThrow(() -> new NaoEncontradoException("Grupo não encontrado na sessão."));
        if (!pendente(g)) {
            return Gravado.NADA; // já importado (reenvio) ou descartado: idempotente
        }
        boolean travaPorNome = "CRIAR_ALUNO".equals(g.destino()) && g.nomeLidoDoConteudo();
        Gravado gravado = "MODELO_BIBLIOTECA".equals(g.destino()) ? gravarModelo(g)
                : gravarAluno(g, usuarioId, travaPorNome ? nomesJaCriados(sessao) : Set.of());
        if (travaPorNome && gravado.aluno() != null && gravado.aluno().criado()) {
            SessaoJson.registrarAlunoCriado(json, sessao, gravado.aluno().alunoId());
        }
        List<GrupoImportavel> novos = new ArrayList<>();
        for (GrupoImportavel x : grupos) {
            novos.add(x.id().equals(grupoId) ? x.limpo("IMPORTADO", x.destino()) : x);
        }
        SessaoJson.gravarGrupos(json, sessao, novos);
        return gravado;
    }

    private Gravado gravarModelo(GrupoImportavel g) {
        if (g.treino() == null && g.dieta() == null) {
            throw new BadRequestException("O grupo não tem treino nem dieta para virar modelo.", "SEM_CONTEUDO");
        }
        String nome = truncar(temTexto(g.nomeDetectado()) ? g.nomeDetectado().strip() : "Importado", NOME_DO_ALUNO);
        int treino = 0;
        int dieta = 0;
        if (g.treino() != null) {
            receitas.salvarConteudo(Receita.Tipo.PLANO_TREINO, nome, null, g.treino());
            treino = 1;
        }
        if (g.dieta() != null) {
            // Modelo nunca leva medicação nem ergogênicos (dado sensível do aluno).
            receitas.salvarConteudo(Receita.Tipo.PLANO_DIETA, nome, null, g.dieta().semErgogenicos());
            dieta = 1;
        }
        return new Gravado(0, 0, 0, 0, treino + dieta, 0, 0, true, null);
    }

    private Gravado gravarAluno(GrupoImportavel g, UUID usuarioId, Set<String> nomesCriados) {
        boolean novo = "CRIAR_ALUNO".equals(g.destino());
        if (!novo && !"VINCULAR_EXISTENTE".equals(g.destino())) {
            throw new BadRequestException("Destino do grupo inválido.", "DESTINO_INVALIDO");
        }
        CadastroImportavel c = g.cadastro();
        String nome = c != null && temTexto(c.nome()) ? c.nome().strip() : g.nomeDetectado();
        String email = c == null || !temTexto(c.email()) ? null : c.email().strip();
        String objetivo = c == null || !temTexto(c.objetivo()) ? null : c.objetivo().strip();
        String observacoes = c == null || !temTexto(c.observacoes()) ? null : c.observacoes().strip();
        String telefone = null;

        // Tudo é conferido antes do primeiro efeito.
        if (novo && g.nomeSubstituto()) {
            // A fase 1 já recusa; aqui fecha a corrida com um PUT do destino entre as duas fases.
            throw new BadRequestException(NOME_PENDENTE, "NOME_DO_ALUNO_PENDENTE");
        }
        if (!temTexto(nome) || nome.strip().length() > NOME_DO_ALUNO) {
            throw new BadRequestException("Nome do aluno inválido.", "NOME_INVALIDO");
        }
        if (objetivo != null && objetivo.length() > OBJETIVO_DO_ALUNO) {
            throw new BadRequestException("O objetivo é longo demais.", "OBJETIVO_GRANDE_DEMAIS");
        }
        if (observacoes != null && observacoes.length() > OBSERVACOES_DO_ALUNO) {
            throw new BadRequestException("As observações são longas demais.", "OBSERVACOES_GRANDES_DEMAIS");
        }
        String chaveDoNome = ImportacaoAssistidaService.chaveDoNome(nome);
        if (novo && nomesCriados.contains(chaveDoNome)) {
            throw new ConflictException("Já foi criado um aluno com este nome nesta importação.", "MESMO_NOME_NA_SESSAO");
        }
        if (novo) {
            if (email != null && (email.length() > 254 || !EMAIL_SIMPLES.matcher(email).matches())) {
                throw new BadRequestException("E-mail inválido.", "EMAIL_INVALIDO");
            }
            telefone = telefoneValido(c == null ? null : c.telefone());
            // A mesma trava do aceite da inscrição: dois grupos com o mesmo e-mail ficam em série.
            consultorias.travar(TenantContext.get());
            if (email != null) {
                List<Aluno> iguais = alunos.findByEmailIgnoreCase(email);
                if (!iguais.isEmpty()) {
                    throw new ConflitoComRecursoException("Já existe um aluno com este e-mail. Abra a ficha dele.",
                            "ALUNO_JA_EXISTE", "alunoId", iguais.getFirst().getId());
                }
            }
        }

        UUID alunoId;
        String nomeDoAluno;
        Aluno existente = null;
        if (novo) {
            var criado = alunoService.criar(new AlunoRequest(nome.strip(), email, telefone, objetivo, observacoes, null,
                    null, null, null, null, null, null, null, null, null, null, null, null, null));
            alunoId = criado.id();
            nomeDoAluno = criado.nome();
        } else {
            if (g.alunoExistenteId() == null) {
                throw new BadRequestException("Escolha o aluno existente.", "ALUNO_NAO_ESCOLHIDO");
            }
            existente = alunos.buscarParaAlterar(g.alunoExistenteId())
                    .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
            AlunoService.exigirNaoAnonimizado(existente);
            if (!existente.isAtivo()) {
                throw new ConflictException("Este aluno está inativo. Reative-o antes de importar.", "ALUNO_INATIVO");
            }
            alunoId = existente.getId();
            nomeDoAluno = existente.getNome();
            // Só preenche o que está vazio: a importação nunca sobrescreve o que o treinador já escreveu.
            if (objetivo != null && !temTexto(existente.getObjetivo())) {
                existente.alterarObjetivo(objetivo);
            }
            if (observacoes != null && !temTexto(existente.getObservacoes())) {
                existente.alterarDados(existente.getNome(), existente.getEmail(), existente.getObjetivo(), observacoes,
                        existente.getDiasAtualizacao());
            }
        }

        int[] contagem = gravarPesos(g.pesos(), alunoId, !novo, usuarioId);
        int treino = 0;
        int dieta = 0;
        UUID pastaId = null;
        UUID treinoId = null;
        UUID dietaId = null;
        if (g.treino() != null || g.dieta() != null) {
            PastaPlano pasta = new PastaPlano(alunoId, TITULO_DA_PASTA, null, null);
            pastas.saveAndFlush(pasta);
            pastaId = pasta.getId();
            if (g.treino() != null) {
                PlanoTreino t = new PlanoTreino(alunoId, titulo("Treino de ", nome), null, null,
                        json.writeValueAsString(g.treino()));
                t.definirPasta(pasta.getId());
                treinos.saveAndFlush(t);
                treinoId = t.getId();
                treino = 1;
            }
            if (g.dieta() != null) {
                // Sem ERGOGENICO_ALTERAR a dieta entra sem a medicação e os ergogênicos; não há o que preservar num plano novo.
                ConteudoDieta conteudoDaDieta = AcessoAtual.pode("ERGOGENICO_ALTERAR") ? g.dieta() : g.dieta().semErgogenicos();
                PlanoDieta d = new PlanoDieta(alunoId, titulo("Dieta de ", nome), null, null,
                        json.writeValueAsString(conteudoDaDieta));
                d.definirPasta(pasta.getId());
                dietas.saveAndFlush(d);
                dietaId = d.getId();
                dieta = 1;
            }
        }
        return new Gravado(novo ? 1 : 0, novo ? 0 : 1, treino, dieta, 0, contagem[0], contagem[1], true,
                new AlunoGravado(alunoId, nomeDoAluno, novo, pastaId, treinoId, dietaId));
    }

    /**
     * Peso sem data legível, fora da faixa, repetido na data ou já existente nessa data não é gravado e conta como
     * ignorado (nunca se inventa a data nem se sobrescreve peso). Devolve {gravados, ignorados}.
     */
    private int[] gravarPesos(List<PesoImportavel> lista, UUID alunoId, boolean verExistentes, UUID usuarioId) {
        if (lista == null || lista.isEmpty()) {
            return new int[] {0, 0};
        }
        LocalDate hoje = FaixaDeData.hoje();
        Set<LocalDate> vistas = new HashSet<>();
        int gravados = 0;
        int ignorados = 0;
        for (PesoImportavel p : lista) {
            BigDecimal kg = p == null || p.kg() == null ? null : p.kg().setScale(2, RoundingMode.HALF_UP);
            boolean valido = p != null && p.data() != null && FaixaDeData.REGISTRO.aceita(p.data(), hoje) && kg != null
                    && kg.signum() > 0 && kg.compareTo(PESO_MAXIMO) < 0;
            if (!valido || !vistas.add(p.data())
                    || (verExistentes && pesos.findByAlunoIdAndData(alunoId, p.data()).isPresent())) {
                ignorados++;
                continue;
            }
            pesos.saveAndFlush(new RegistroPeso(alunoId, p.data(), kg, truncar(p.observacao(), 300), usuarioId));
            gravados++;
        }
        return new int[] {gravados, ignorados};
    }

    // ------------------------------------------------------------------------------------------------ fase 3

    /** Marca o grupo que falhou com um código fixo; o conteúdo continua na sessão para o treinador corrigir. */
    private void marcarErro(UUID sessaoId, String grupoId, String codigo) {
        sessoes.buscarParaAlterar(sessaoId, TenantContext.get()).ifPresent(sessao -> {
            List<GrupoImportavel> novos = new ArrayList<>();
            for (GrupoImportavel g : SessaoJson.grupos(json, sessao)) {
                novos.add(g.id().equals(grupoId) && !"IMPORTADO".equals(g.estado()) ? g.comErro(codigo) : g);
            }
            SessaoJson.gravarGrupos(json, sessao, novos);
        });
    }

    /**
     * Fecha a sessão: sem grupo pendente nem com erro ela está concluída e perde tudo que ainda tinha dado do arquivo
     * (grupos ignorados, dúvidas e respostas); senão volta a {@code REVISANDO}. Audita uma vez, só se algo foi gravado.
     */
    private void fechar(UUID sessaoId, UUID usuarioId, int importados, String chaveIdempotencia, String hashPedido,
                        ConfirmacaoResultado resultado) {
        ImportacaoSessao sessao = sessoes.buscarParaAlterar(sessaoId, TenantContext.get())
                .orElseThrow(() -> new NaoEncontradoException("Sessão de importação não encontrada."));
        List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
        boolean aberta = grupos.stream().anyMatch(g -> pendente(g) || "ERRO".equals(g.estado()));
        if (!aberta) {
            List<GrupoImportavel> limpos = new ArrayList<>();
            for (GrupoImportavel g : grupos) {
                limpos.add("IMPORTADO".equals(g.estado()) ? g : g.limpo("IGNORADO", g.destino()));
            }
            SessaoJson.gravarGrupos(json, sessao, limpos);
            sessao.aplicarRespostas("[]", null, "[]");
            sessao.atualizarEstado("CONCLUIDA");
            arquivos.limparConteudoBytesDaSessao(sessaoId);
        } else {
            sessao.atualizarEstado("REVISANDO");
        }
        registrarConfirmacaoEmProgresso(sessao, chaveIdempotencia, hashPedido, resultado);
        if (importados > 0) {
            auditoria.registrarEvento("IMPORTACAO_ASSISTIDA_CONCLUIDA", "IMPORTACAO", sessaoId,
                    "Importou dados pela importação assistida.");
        }
        int tentados = resultado.gruposImportados() + resultado.gruposComErro();
        if (tentados > 0) {
            // Mesma transação do registro da idempotência: a repetição do pedido não grava outra linha.
            historico.save(new Importacao(DESTINO_NO_HISTORICO, "", usuarioId, tentados,
                    resultado.alunosCriados() + resultado.modelosCriados(), resultado.alunosVinculados(), 0,
                    resultado.gruposComErro(), resultado.situacao(), "{}", "[]"));
        }
    }

    private void registrarConfirmacaoEmProgresso(ImportacaoSessao sessao, String chave, String hashPedido,
                                                 ConfirmacaoResultado resultado) {
        if (chave == null || hashPedido == null || resultado == null) {
            return;
        }
        ObjectNode root;
        try {
            JsonNode lido = sessao.getProgressoJson() == null || sessao.getProgressoJson().isBlank()
                    ? json.createObjectNode()
                    : json.readTree(sessao.getProgressoJson());
            root = lido instanceof ObjectNode o ? o : json.createObjectNode();
        } catch (RuntimeException e) {
            root = json.createObjectNode();
        }
        ObjectNode confs = root.get("confirmacoes") instanceof ObjectNode c ? c : json.createObjectNode();
        Map<String, Object> registro = new HashMap<>();
        registro.put("hashPedido", hashPedido);
        registro.put("resultado", resultado);
        confs.set(chave, json.valueToTree(registro));
        root.set("confirmacoes", confs);
        sessao.atualizarResultados(null, null, json.writeValueAsString(root));
    }

    // ------------------------------------------------------------------------------------------------ auxiliares

    /** Código curto e fixo para {@code erroCodigo}: o da API quando tem o formato, senão um genérico. Nunca a mensagem. */
    static String codigoDe(RuntimeException e) {
        if (e instanceof AccessDeniedException) {
            return "SEM_PERMISSAO";
        }
        if (e instanceof ApiException a) {
            String c = a.getCodigo();
            return c != null && CODIGO_FIXO.matcher(c).matches() ? c : "DADOS_INVALIDOS";
        }
        if (e instanceof DataIntegrityViolationException) {
            return "CONFLITO_DE_DADOS";
        }
        return "ERRO_AO_GRAVAR";
    }

    private static String telefoneValido(String telefone) {
        try {
            return Formatos.telefone(telefone);
        } catch (BadRequestException e) {
            throw new BadRequestException("Telefone inválido.", "TELEFONE_INVALIDO");
        }
    }

    private static boolean temTexto(String s) {
        return s != null && !s.isBlank();
    }

    private static String truncar(String s, int max) {
        if (s == null) {
            return null;
        }
        String t = s.strip();
        return t.length() <= max ? t : t.substring(0, max).strip();
    }

    private static String titulo(String prefixo, String nome) {
        return truncar(prefixo + (nome == null ? "" : nome.strip()), TITULO_DO_PLANO);
    }
}
