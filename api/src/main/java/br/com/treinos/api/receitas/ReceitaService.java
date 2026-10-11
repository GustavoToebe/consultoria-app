package br.com.treinos.api.receitas;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.VideoUrls;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ReceitaService {

    public record ReceitaRequest(
            @NotNull Receita.Tipo tipo,
            @NotBlank @Size(max = 120) String nome,
            @Size(max = 400) String descricao,
            @NotNull JsonNode conteudo, UUID pastaId, Long versao) {
        public ReceitaRequest(Receita.Tipo tipo, String nome, String descricao, JsonNode conteudo) {
            this(tipo, nome, descricao, conteudo, null, null);
        }
    }

    public record ReceitaResponse(UUID id, String tipo, String nome, String descricao, JsonNode conteudo, int ordem, UUID pastaId, Long versao) {
    }

    private final ReceitaRepository receitas;
    private final JsonMapper json;
    private final Validator validator;
    private final PastaModeloRepository pastas;
    private final VideoUrls videoUrls;

    public ReceitaService(ReceitaRepository receitas, JsonMapper json, Validator validator, PastaModeloRepository pastas,
                          VideoUrls videoUrls) {
        this.receitas = receitas;
        this.json = json;
        this.validator = validator;
        this.pastas = pastas;
        this.videoUrls = videoUrls;
    }

    @Transactional(readOnly = true)
    public List<ReceitaResponse> listar(Receita.Tipo tipo) {
        List<Receita> lista = tipo == null ? receitas.findAllByOrderByTipoAscOrdemAscNomeAsc()
                : receitas.findByTipoOrderByOrdemAscNomeAsc(tipo);
        return lista.stream().map(this::resposta).toList();
    }

    @Transactional
    public ReceitaResponse criar(ReceitaRequest r) {
        String conteudo = conteudoValidado(r.tipo(), r.conteudo());
        Receita receita = new Receita(r.tipo(), r.nome().trim(), Buscas.opcional(r.descricao()), conteudo,
                receitas.maiorOrdem(r.tipo()) + 1);
        receita.definirPasta(exigirPasta(r.pastaId()));
        return resposta(receitas.saveAndFlush(receita));
    }

    @Transactional
    public ReceitaResponse alterar(UUID id, ReceitaRequest r) {
        Receita receita = buscar(id);
        exigirVersao(receita, r.versao());
        if (receita.getTipo() != r.tipo()) {
            throw new BadRequestException("O tipo da receita não pode mudar.");
        }
        receita.alterar(r.nome().trim(), Buscas.opcional(r.descricao()), conteudoValidado(r.tipo(), r.conteudo()));
        receita.definirPasta(exigirPasta(r.pastaId()));
        return resposta(receitas.saveAndFlush(receita));
    }

    @Transactional
    public void excluir(UUID id) {
        receitas.delete(buscar(id));
    }

    /** Receitas da seção 9.6, criadas no cadastro do treinador (com a consultoria nova no {@code TenantContext}). */
    @Transactional
    public void criarPadrao() {
        int ordem = 0;
        for (ReceitasPadrao.Padrao p : ReceitasPadrao.todas()) {
            receitas.save(new Receita(p.tipo(), p.nome(), p.descricao(), json.writeValueAsString(p.conteudo()), ++ordem));
        }
    }

    /** Conteúdo de uma receita de plano, já com uids novos (aplicar não reaproveita uid). */
    @Transactional(readOnly = true)
    public ConteudoTreino conteudoTreino(UUID id) {
        Receita receita = buscar(id);
        if (receita.getTipo() != Receita.Tipo.PLANO_TREINO && receita.getTipo() != Receita.Tipo.SESSAO_TREINO)
            throw new BadRequestException("Escolha um modelo de semana ou treino.");
        return json.readValue(receita.getConteudo(), ConteudoTreino.class).comUidsNovos();
    }

    @Transactional(readOnly = true)
    public ConteudoDieta conteudoDieta(UUID id) {
        Receita receita = buscar(id);
        if (receita.getTipo() != Receita.Tipo.PLANO_DIETA && receita.getTipo() != Receita.Tipo.REFEICAO)
            throw new BadRequestException("Escolha um modelo de dieta ou refeição.");
        return json.readValue(receita.getConteudo(), ConteudoDieta.class).semErgogenicos().comUidsNovos();
    }

    @Transactional(readOnly = true)
    public ConteudoMobilidade conteudoMobilidade(UUID id) {
        Receita receita = buscar(id);
        if (receita.getTipo() != Receita.Tipo.MOBILIDADE)
            throw new BadRequestException("Escolha um modelo de mobilidade.");
        return json.readValue(receita.getConteudo(), ConteudoMobilidade.class).comUidsNovos();
    }

    /** "Salvar como receita" a partir do rascunho de um plano. */
    @Transactional
    public ReceitaResponse salvarConteudo(Receita.Tipo tipo, String nome, String descricao, Object conteudo) {
        return criar(new ReceitaRequest(tipo, nome, descricao, json.valueToTree(conteudo)));
    }

    private String conteudoValidado(Receita.Tipo tipo, JsonNode conteudo) {
        Class<?> classe = switch (tipo) {
            case SERIES -> ReceitaSeries.class;
            case PLANO_TREINO -> ConteudoTreino.class;
            case PLANO_DIETA, REFEICAO -> ConteudoDieta.class;
            case SESSAO_TREINO -> ConteudoTreino.class;
            case METODOLOGIA -> ConfiguracaoConsultoria.class;
            case PASTA_PLANO -> ConteudoPastaModelo.class;
            case MOBILIDADE -> ConteudoMobilidade.class;
        };
        Object valor;
        try {
            valor = json.treeToValue(conteudo, classe);
        } catch (JacksonException e) {
            throw new BadRequestException("O conteúdo não corresponde ao tipo da receita.");
        }
        if (valor == null) {
            throw new BadRequestException("A receita precisa de conteúdo.");
        }
        Set<ConstraintViolation<Object>> violacoes = validator.validate(valor);
        if (!violacoes.isEmpty()) {
            throw new BadRequestException("Conteúdo da receita inválido: " + violacoes.iterator().next().getPropertyPath()
                    + " " + violacoes.iterator().next().getMessage());
        }
        if (valor instanceof ConfiguracaoConsultoria c) MarcaService.validar(c);
        if (valor instanceof ConteudoTreino t) {
            validarMetodologia(t);
            if (tipo == Receita.Tipo.SESSAO_TREINO && t.sessoes().size() != 1)
                throw new BadRequestException("Modelo de treino precisa de uma sessão.");
        }
        // Modelo nunca leva medicação e ergogênicos (dado pessoal de aluno): sai antes de gravar.
        if (valor instanceof ConteudoDieta d) valor = d.semErgogenicos();
        if (tipo == Receita.Tipo.REFEICAO && ((ConteudoDieta) valor).refeicoes().size() != 1)
            throw new BadRequestException("Modelo de refeição precisa de uma refeição.");
        if (valor instanceof ConteudoPastaModelo pasta) {
            List<ConteudoPastaModelo.Plano> planos = new java.util.ArrayList<>();
            for (ConteudoPastaModelo.Plano p : pasta.planos()) {
                if (p.tipos() != 1)
                    throw new BadRequestException("Cada plano da pasta precisa ser treino, dieta ou mobilidade.");
                if (p.treino() != null) validarMetodologia(p.treino());
                planos.add(new ConteudoPastaModelo.Plano(p.titulo(), p.treino(),
                        p.dieta() == null ? null : p.dieta().semErgogenicos(),
                        p.mobilidade() == null ? null : exigirMobilidadeCompleta(p.mobilidade())));
            }
            valor = new ConteudoPastaModelo(planos);
        }
        if (valor instanceof ConteudoMobilidade m) {
            valor = exigirMobilidadeCompleta(m);
        }
        return json.writeValueAsString(valor);
    }

    /** Modelo é gravado completo (o rascunho do plano é que aceita conteúdo em construção); vídeo sai normalizado. */
    private ConteudoMobilidade exigirMobilidadeCompleta(ConteudoMobilidade m) {
        if (m.secoes().isEmpty()) throw new BadRequestException("O modelo de mobilidade precisa de uma seção.");
        if (m.secoes().stream().flatMap(sec -> sec.itens().stream())
                .anyMatch(i -> i.nome() == null || i.nome().isBlank()))
            throw new BadRequestException("Todo item de mobilidade precisa de nome.");
        return m.comVideos(videoUrls::normalizar);
    }

    public static void validarMetodologia(ConteudoTreino t) {
        if (t.metodologia() != null) MarcaService.validar(t.metodologia().configuracao());
    }

    @Transactional(readOnly = true)
    public ReceitaResponse detalhe(UUID id) { return resposta(buscar(id)); }

    public record ConteudoRequest(@NotBlank @Size(max = 120) String nome,
                                  @NotNull JsonNode conteudo, @NotNull Long versao) { }

    @Transactional
    public ReceitaResponse salvarConteudo(UUID id, ConteudoRequest r) {
        Receita atual = buscar(id);
        return alterar(id, new ReceitaRequest(atual.getTipo(), r.nome(), atual.getDescricao(),
                r.conteudo(), atual.getPastaId(), r.versao()));
    }

    @Transactional
    public ReceitaResponse duplicar(UUID id) {
        Receita r = buscar(id);
        String nome = r.getNome().substring(0, Math.min(110, r.getNome().length())) + " (cópia)";
        return criar(new ReceitaRequest(r.getTipo(), nome, r.getDescricao(), json.readTree(r.getConteudo()), r.getPastaId(), null));
    }

    private UUID exigirPasta(UUID id) {
        if (id != null && pastas.findById(id).isEmpty()) throw new NaoEncontradoException("Pasta não encontrada.");
        return id;
    }

    private static void exigirVersao(Receita r, Long versao) {
        if (versao != null && !versao.equals(r.getVersao()))
            throw new ConflitoException("O modelo mudou em outra aba. Recarregue antes de salvar.", "CONFLITO_EDICAO");
    }

    private Receita buscar(UUID id) {
        return receitas.findById(id).orElseThrow(() -> new NaoEncontradoException("Receita não encontrada."));
    }

    private ReceitaResponse resposta(Receita r) {
        return new ReceitaResponse(r.getId(), r.getTipo().name(), r.getNome(), r.getDescricao(),
                json.readTree(r.getConteudo()), r.getOrdem(), r.getPastaId(), r.getVersao());
    }
}
