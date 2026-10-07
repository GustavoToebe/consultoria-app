package br.com.treinos.api.receitas;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
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
            @NotNull JsonNode conteudo) {
    }

    public record ReceitaResponse(UUID id, String tipo, String nome, String descricao, JsonNode conteudo, int ordem) {
    }

    private final ReceitaRepository receitas;
    private final JsonMapper json;
    private final Validator validator;

    public ReceitaService(ReceitaRepository receitas, JsonMapper json, Validator validator) {
        this.receitas = receitas;
        this.json = json;
        this.validator = validator;
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
        return resposta(receitas.saveAndFlush(receita));
    }

    @Transactional
    public ReceitaResponse alterar(UUID id, ReceitaRequest r) {
        Receita receita = buscar(id);
        if (receita.getTipo() != r.tipo()) {
            throw new BadRequestException("O tipo da receita não pode mudar.");
        }
        receita.alterar(r.nome().trim(), Buscas.opcional(r.descricao()), conteudoValidado(r.tipo(), r.conteudo()));
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
        Receita receita = buscarDoTipo(id, Receita.Tipo.PLANO_TREINO);
        return json.readValue(receita.getConteudo(), ConteudoTreino.class).comUidsNovos();
    }

    @Transactional(readOnly = true)
    public ConteudoDieta conteudoDieta(UUID id) {
        Receita receita = buscarDoTipo(id, Receita.Tipo.PLANO_DIETA);
        return json.readValue(receita.getConteudo(), ConteudoDieta.class).comUidsNovos();
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
            case PLANO_DIETA -> ConteudoDieta.class;
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
        return json.writeValueAsString(valor);
    }

    private Receita buscar(UUID id) {
        return receitas.findById(id).orElseThrow(() -> new NaoEncontradoException("Receita não encontrada."));
    }

    private Receita buscarDoTipo(UUID id, Receita.Tipo tipo) {
        Receita receita = buscar(id);
        if (receita.getTipo() != tipo) {
            throw new BadRequestException("Esta receita não é do tipo " + tipo.name() + ".");
        }
        return receita;
    }

    private ReceitaResponse resposta(Receita r) {
        return new ReceitaResponse(r.getId(), r.getTipo().name(), r.getNome(), r.getDescricao(),
                json.readTree(r.getConteudo()), r.getOrdem());
    }
}
