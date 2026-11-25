package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.vitrine.VitrineDtos.CategoriaRequest;
import br.com.treinos.api.vitrine.VitrineDtos.CategoriaResponse;
import br.com.treinos.api.vitrine.VitrineDtos.OrdemDeCategoriasRequest;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.ConflitoComRecursoException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Categorias da vitrine (V099): a equipe cria, renomeia, apaga e ordena ({@code VITRINE_ALTERAR}); item sem categoria é válido. O nome
 * é texto do treinador: mensagens fixas e auditoria com resumo fixo, nunca o nome. Toda escrita trava a consultoria (como criar e
 * reordenar itens): o teto de {@link #LIMITE_DE_CATEGORIAS}, a ordem e a unicidade do nome não perdem corrida, e apagar uma categoria
 * nunca cruza com o item que está sendo gravado nela (a trava da consultoria vem sempre antes da linha do item: sem deadlock).
 * Categoria de outra consultoria some pelo filtro do tenant (404 nas rotas de categoria; no item, 422 em {@code categoriaId}, igual ao inexistente). Apagar deixa os itens sem categoria (FK
 * {@code ON DELETE SET NULL (categoria_id)}).
 */
@Service
public class VitrineCategoriaService {

    static final int LIMITE_DE_CATEGORIAS = 30;
    static final int NOME_MAXIMO = 40;
    /** Tamanho da coluna {@code vitrine_categoria.nome_normalizado} (V099). */
    static final int NOME_NORMALIZADO_MAXIMO = 80;
    static final String CODIGO_INVALIDA = "VITRINE_CATEGORIA_INVALIDA";
    static final String CODIGO_DUPLICADA = "VITRINE_CATEGORIA_DUPLICADA";
    static final String CODIGO_LIMITE = "VITRINE_CATEGORIAS_LIMITE";

    private final VitrineCategoriaRepository categorias;
    private final VitrineItemRepository itens;
    private final TravaDaVitrine trava;
    private final Auditoria auditoria;

    public VitrineCategoriaService(VitrineCategoriaRepository categorias, VitrineItemRepository itens,
                                   TravaDaVitrine trava, Auditoria auditoria) {
        this.categorias = categorias;
        this.itens = itens;
        this.trava = trava;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listar() {
        Map<UUID, Long> quantidades = quantidades();
        return categorias.todas().stream().map(c -> resposta(c, quantidades.getOrDefault(c.getId(), 0L))).toList();
    }

    /** Ordem das recusas: 422, 409 do teto, 409 do nome repetido. A nova categoria vai para o fim. */
    @Transactional
    public CategoriaResponse criar(CategoriaRequest r) {
        String nome = validar(r);
        trava.travar();
        if (categorias.count() >= LIMITE_DE_CATEGORIAS) {
            throw new ConflictException("A vitrine pode ter no máximo " + LIMITE_DE_CATEGORIAS + " categorias. Apague uma antes.",
                    CODIGO_LIMITE);
        }
        if (categorias.existsByNomeNormalizado(Buscas.semAcento(nome))) {
            throw nomeEmUso();
        }
        VitrineCategoria c = categorias.saveAndFlush(new VitrineCategoria(nome, categorias.maiorOrdem() + 1));
        auditoria.registrarEvento("VITRINE_CATEGORIA_CRIADA", "VITRINE_CATEGORIA", c.getId(), "Criou uma categoria da vitrine.");
        return resposta(c, 0);
    }

    /** Ordem das recusas: 404, 422, 409. Nome igual ao gravado = 200 sem auditoria. */
    @Transactional
    public CategoriaResponse renomear(UUID id, CategoriaRequest r) {
        trava.travar();
        VitrineCategoria c = categorias.findById(id).orElseThrow(VitrineCategoriaService::naoEncontrada);
        String nome = validar(r);
        if (categorias.existsByNomeNormalizadoAndIdNot(Buscas.semAcento(nome), id)) {
            throw nomeEmUso();
        }
        if (c.renomear(nome)) {
            categorias.saveAndFlush(c);
            auditoria.registrarEvento("VITRINE_CATEGORIA_RENOMEADA", "VITRINE_CATEGORIA", id, "Renomeou uma categoria da vitrine.");
        }
        return resposta(c, quantidades().getOrDefault(id, 0L));
    }

    /** Os itens da categoria ficam sem categoria (o banco anula a coluna); nenhum item é apagado. Inexistente = 404, como o item. */
    @Transactional
    public void excluir(UUID id) {
        trava.travar();
        VitrineCategoria c = categorias.findById(id).orElseThrow(VitrineCategoriaService::naoEncontrada);
        categorias.delete(c);
        categorias.flush();
        auditoria.registrarEvento("VITRINE_CATEGORIA_EXCLUIDA", "VITRINE_CATEGORIA", id, "Excluiu uma categoria da vitrine.");
    }

    /**
     * Grava a ordem que a tela mandou: {@code ids} com todas as categorias, uma vez cada, senão 422 (lista malformada) ou 409
     * {@code CONFLITO_EDICAO} (categoria criada ou apagada por outra pessoa enquanto a tela olhava). Os lugares são renumerados de 0
     * a N-1; ordem igual à gravada não muda nada nem audita.
     */
    @Transactional
    public void ordenar(OrdemDeCategoriasRequest r) {
        List<UUID> ids = r.ids();
        if (ids == null || ids.contains(null) || new HashSet<>(ids).size() != ids.size()) {
            throw new ValidacaoException("Confira os dados da categoria.", CODIGO_INVALIDA,
                    List.of(new ApiError.FieldError("ids", "Envie cada categoria uma única vez.")));
        }
        trava.travar();
        Map<UUID, VitrineCategoria> porId = new HashMap<>();
        categorias.todas().forEach(c -> porId.put(c.getId(), c));
        if (!porId.keySet().equals(new HashSet<>(ids))) {
            throw new ConflictException("As categorias mudaram enquanto você olhava. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
        boolean mudou = false;
        for (int k = 0; k < ids.size(); k++) {
            VitrineCategoria c = porId.get(ids.get(k));
            if (c.getOrdem() != k) {
                c.ordenarEm(k);
                mudou = true;
            }
        }
        if (mudou) {
            categorias.flush();
            auditoria.registrarEvento("VITRINE_CATEGORIAS_REORDENADAS", "VITRINE_CATEGORIA", null,
                    "Mudou a ordem das categorias da vitrine.");
        }
    }

    /**
     * Para o item: a categoria da consultoria da sessão, ou 422 {@code VITRINE_ITEM_INVALIDO} em {@code categoriaId} (a mesma resposta
     * para inexistente e para outra consultoria: nunca revela a diferença). Nulo = sem categoria.
     */
    VitrineCategoria exigir(UUID id) {
        return id == null ? null : categorias.findById(id).orElseThrow(() -> new ValidacaoException("Confira os dados do item.",
                VitrineService.CODIGO_INVALIDO, List.of(new ApiError.FieldError("categoriaId", "Categoria não encontrada."))));
    }

    /** Todas as categorias da consultoria por id, para montar as respostas dos itens (uma consulta). */
    Map<UUID, VitrineCategoria> porId() {
        Map<UUID, VitrineCategoria> mapa = new LinkedHashMap<>();
        categorias.todas().forEach(c -> mapa.put(c.getId(), c));
        return mapa;
    }

    /** Nome com strip e NFC, de 1 a 40, sem caractere de controle; mensagens fixas (o valor digitado nunca é repetido). */
    private static String validar(CategoriaRequest r) {
        // strip() não tira U+00A0, U+2007, U+202F nem caracteres de formatação (U+200B): viram espaço comum antes, para "Livros " e
        // "Livros" colidirem e um nome só de invisíveis ser vazio.
        String nome = r.nome() == null ? "" : Normalizer.normalize(r.nome().replaceAll("[\\p{Z}\\p{Cf}]+", " ").strip(), Normalizer.Form.NFC);
        String problema = null;
        if (nome.isEmpty()) {
            problema = "Informe o nome da categoria.";
        } else if (nome.length() > NOME_MAXIMO) {
            problema = "Use no máximo " + NOME_MAXIMO + " caracteres.";
        } else if (nome.chars().anyMatch(Character::isISOControl) || Buscas.semAcento(nome).isEmpty()) {
            problema = "Use letras, números ou símbolos no nome.";
        } else if (Buscas.semAcento(nome).length() > NOME_NORMALIZADO_MAXIMO) {
            // Alfabetos que decompõem (hangul) passam de 80 depois do NFD e estourariam a coluna nome_normalizado.
            problema = "Este nome é longo demais; use um nome mais curto.";
        }
        if (problema != null) {
            throw new ValidacaoException("Confira os dados da categoria.", CODIGO_INVALIDA,
                    List.of(new ApiError.FieldError("nome", problema)));
        }
        return nome;
    }

    private Map<UUID, Long> quantidades() {
        Map<UUID, Long> mapa = new HashMap<>();
        itens.contagemPorCategoria().forEach(c -> mapa.put(c.getCategoriaId(), c.getItens()));
        return mapa;
    }

    private static CategoriaResponse resposta(VitrineCategoria c, long quantidade) {
        return new CategoriaResponse(c.getId(), c.getNome(), c.getOrdem(), quantidade);
    }


    private static ConflitoComRecursoException nomeEmUso() {
        String mensagem = "Já existe uma categoria com esse nome.";
        return new ConflitoComRecursoException(mensagem, CODIGO_DUPLICADA, List.of(new ApiError.FieldError("nome", mensagem)));
    }

    static NaoEncontradoException naoEncontrada() {
        return new NaoEncontradoException("Categoria da vitrine não encontrada.");
    }
}
