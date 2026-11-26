package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.web.ValidacaoException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Opções de personalização dos PDFs (V106): só as sobrescritas do modelo escolhido (chave ausente = valor do modelo), em JSON
 * com chaves conhecidas e valores de lista fechada, nunca HTML nem CSS. Chave ou valor desconhecido é recusado com 422 no
 * campo e mensagem fixa, sem repetir o que veio (nem a chave, que pode ser texto livre: o campo aponta a seção).
 * Opção nova entra só em {@link #ESQUEMA} (e no espelho do app); {@code rodape} e {@code secoes} do N2 pedem um {@link Predicate}
 * próprio (texto com limite, lista de seções).
 */
public final class OpcoesPdf {

    public static final String CODIGO_INVALIDO = "DOCUMENTOS_PDF_INVALIDOS";
    static final String MENSAGEM_VALOR = "Escolha uma das opções da lista.";
    static final String MENSAGEM_CHAVE = "Opção não reconhecida.";

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static final Predicate<JsonNode> BOOLEANO = JsonNode::isBoolean;

    private static final Map<String, Map<String, Predicate<JsonNode>>> ESQUEMA = esquema();

    private OpcoesPdf() {
    }

    private static Map<String, Map<String, Predicate<JsonNode>>> esquema() {
        var e = new LinkedHashMap<String, Map<String, Predicate<JsonNode>>>();
        e.put("cores", Map.of("destaque", lista("MARCA", "GRAFITE", "AZUL", "INDIGO", "VERDE", "TURQUESA", "MAGENTA", "BRONZE")));
        e.put("texto", Map.of("fonte", lista("SEM_SERIFA", "SERIFADA", "CONDENSADA"), "tamanho", lista("P", "M", "G")));
        e.put("cabecalho", Map.of("estilo", lista("FAIXA", "LINHA", "CARTAO"), "logo", lista("ESQUERDA", "CENTRO"),
                "tamanhoLogo", lista("P", "M", "G"), "mostrarNome", BOOLEANO));
        e.put("tabelas", Map.of("estilo", lista("LINHAS", "LISTRADA", "CARTOES"),
                "densidade", lista("COMPACTA", "NORMAL", "ESPACOSA")));
        return e;
    }

    private static Predicate<JsonNode> lista(String... valores) {
        Set<String> aceitos = Set.of(valores);
        return v -> v.isString() && aceitos.contains(v.asString());
    }

    /**
     * Confere o objeto recebido (nulo ou ausente = sem sobrescritas) e devolve o JSON canônico para gravar: só as chaves
     * conhecidas e válidas, sem seção vazia. Qualquer problema vira 422 {@link #CODIGO_INVALIDO} com todos os campos.
     */
    public static String validarParaGravar(JsonNode bruto) {
        var erros = new ArrayList<ApiError.FieldError>();
        ObjectNode limpo = JSON.createObjectNode();
        if (bruto != null && !bruto.isNull() && !bruto.isMissingNode()) {
            if (!bruto.isObject()) {
                erros.add(new ApiError.FieldError("opcoes", MENSAGEM_VALOR));
            } else {
                for (var secao : bruto.properties()) {
                    var campos = ESQUEMA.get(secao.getKey());
                    if (campos == null) {
                        adicionar(erros, "opcoes", MENSAGEM_CHAVE);
                    } else {
                        ObjectNode secaoLimpa = JSON.createObjectNode();
                        conferirSecao("opcoes." + secao.getKey(), secao.getValue(), campos, secaoLimpa, erros);
                        if (!secaoLimpa.isEmpty()) {
                            limpo.set(secao.getKey(), secaoLimpa);
                        }
                    }
                }
            }
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira as opções dos documentos.", CODIGO_INVALIDO, erros);
        }
        return JSON.writeValueAsString(limpo);
    }

    private static void conferirSecao(String caminho, JsonNode secao, Map<String, Predicate<JsonNode>> campos, ObjectNode saida,
                                      List<ApiError.FieldError> erros) {
        if (!secao.isObject()) {
            adicionar(erros, caminho, MENSAGEM_VALOR);
            return;
        }
        for (var campo : secao.properties()) {
            var regra = campos.get(campo.getKey());
            if (regra == null) {
                adicionar(erros, caminho, MENSAGEM_CHAVE);
            } else if (!regra.test(campo.getValue())) {
                adicionar(erros, caminho + "." + campo.getKey(), MENSAGEM_VALOR);
            } else {
                saida.set(campo.getKey(), campo.getValue());
            }
        }
    }

    private static void adicionar(List<ApiError.FieldError> erros, String campo, String mensagem) {
        if (erros.stream().noneMatch(e -> e.field().equals(campo))) {
            erros.add(new ApiError.FieldError(campo, mensagem));
        }
    }

    /** O JSON gravado como objeto, para a resposta (a coluna é {@code not null} com CHECK de objeto). */
    public static JsonNode ler(String gravado) {
        return JSON.readTree(gravado);
    }
}
