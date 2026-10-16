package br.com.treinos.api.atualizacoes;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

/**
 * Devolve só respostas conhecidas. Mensagens nunca repetem o valor sensível enviado. Mesmas regras de
 * {@code errosRespostasAtualizacao} em {@code app/src/dominio/respostasAtualizacao.ts} (o teste de paridade confere os campos).
 */
@Component
public class ValidadorAtualizacao {
    private final JsonMapper json;
    public ValidadorAtualizacao(JsonMapper json) { this.json = json; }
    /** Com as fotos desligadas (padrão): a pergunta FOTOS é ignorada, como sempre foi. */
    public JsonNode validar(JsonNode modelo, JsonNode respostas) { return validar(modelo, respostas, false); }
    /**
     * Com as fotos ligadas, a resposta de FOTOS é a lista de ids das fotos já enviadas (sem repetir, no máximo
     * {@link LimitesQuestionario#FOTOS_POR_PERGUNTA}); quem as liga à atualização é o {@code FotoService}, no envio.
     */
    public JsonNode validar(JsonNode modelo, JsonNode respostas, boolean fotosLigadas) {
        var erros = new ArrayList<ApiError.FieldError>();
        var limpas = json.createObjectNode();
        if (respostas == null || !respostas.isObject() || json.writeValueAsString(respostas).getBytes(StandardCharsets.UTF_8).length > LimitesQuestionario.RESPOSTAS_BYTES)
            throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", java.util.List.of(new ApiError.FieldError("respostas", "Respostas inválidas ou acima do limite.")));
        for (var secao : modelo.path("secoes")) for (var p : secao.path("perguntas")) {
            String id = p.path("id").asString(); String tipo = p.path("tipo").asString();
            if ("DATA_AUTOMATICA".equals(tipo) || ("FOTOS".equals(tipo) && !fotosLigadas)) continue;
            var v = respostas.path(id);
            boolean vazio = v.isMissingNode() || v.isNull() || (v.isString() && v.asString().isBlank()) || (v.isArray() && v.isEmpty()) || (v.isObject() && v.isEmpty());
            if (vazio) { if (p.path("obrigatoria").asBoolean(false)) erros.add(new ApiError.FieldError(id, "Preencha este campo.")); continue; }
            boolean valido = switch (tipo) {
                case "NOTA" -> nota(v);
                case "PESO" -> v.isNumber() && v.asDouble() >= 20 && v.asDouble() <= 400 && v.decimalValue().stripTrailingZeros().scale() <= 1;
                case "TEXTO", "TEXTO_LONGO" -> v.isString() && v.asString().length() <= ("TEXTO".equals(tipo) ? LimitesQuestionario.TEXTO_CURTO_CAPACIDADE : LimitesQuestionario.TEXTO_LONGO_CAPACIDADE);
                case "NOTAS_POR_DIA" -> v.isObject() && v.properties().stream().allMatch(e ->
                    p.path("dias").valueStream().anyMatch(d -> String.valueOf(d.asInt()).equals(e.getKey())) && (e.getValue().isNull() || nota(e.getValue())));
                case "ESCOLHA_UNICA" -> v.isString() && idsDasOpcoes(p).contains(v.asString());
                case "MULTIPLA_ESCOLHA" -> multiplaEscolha(p, v);
                case "NUMERO" -> numero(p, v);
                case "SIM_NAO" -> v.isBoolean();
                case "FOTOS" -> fotos(v);
                default -> false;
            };
            if (!valido) erros.add(new ApiError.FieldError(id, "Confira o formato e os limites deste campo."));
            else limpas.set(id, "FOTOS".equals(tipo) ? fotosEmMinusculas(v) : v);
        }
        if (!erros.isEmpty()) throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", erros);
        return limpas;
    }
    private static final java.util.regex.Pattern UUID_TEXTO = java.util.regex.Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    /** Lista de ids (UUID) sem repetição, de 1 a {@code FOTOS_POR_PERGUNTA}. A lista vazia já foi tratada como "não respondida". */
    private static boolean fotos(JsonNode v) {
        if (!v.isArray() || v.size() > LimitesQuestionario.FOTOS_POR_PERGUNTA) return false;
        Set<String> vistos = new HashSet<>();
        for (var item : v) {
            if (!item.isString() || !UUID_TEXTO.matcher(item.asString()).matches()) return false;
            if (!vistos.add(item.asString().toLowerCase(java.util.Locale.ROOT))) return false;
        }
        return true;
    }
    private JsonNode fotosEmMinusculas(JsonNode v) {
        var lista = json.createArrayNode();
        for (var item : v) lista.add(item.asString().toLowerCase(java.util.Locale.ROOT));
        return lista;
    }
    private static boolean nota(JsonNode v) { return v.isIntegralNumber() && v.asLong() >= 0 && v.asLong() <= 10; }
    private static Set<String> idsDasOpcoes(JsonNode pergunta) {
        Set<String> ids = new HashSet<>();
        for (var o : pergunta.path("opcoes")) ids.add(o.path("id").asString());
        return ids;
    }
    /** Lista sem repetição, cada item é o id de uma opção. A lista vazia já foi tratada como "não respondida". */
    private static boolean multiplaEscolha(JsonNode pergunta, JsonNode v) {
        if (!v.isArray()) return false;
        Set<String> ids = idsDasOpcoes(pergunta); Set<String> vistos = new HashSet<>();
        for (var item : v) if (!item.isString() || !ids.contains(item.asString()) || !vistos.add(item.asString())) return false;
        return true;
    }
    /** Dentro de min/max (quando existem) e com no máximo {@code casas} decimais (padrão 0). */
    private static boolean numero(JsonNode pergunta, JsonNode v) {
        if (!v.isNumber() || (v.isFloatingPointNumber() && !Double.isFinite(v.doubleValue()))) return false;
        BigDecimal valor = v.decimalValue();
        if (valor.abs().compareTo(BigDecimal.valueOf(LimitesQuestionario.NUMERO_ABSOLUTO)) > 0) return false;
        int casas = pergunta.path("casas").isNumber() ? pergunta.path("casas").asInt() : 0;
        if (valor.stripTrailingZeros().scale() > casas) return false;
        if (pergunta.path("min").isNumber() && valor.compareTo(pergunta.path("min").decimalValue()) < 0) return false;
        return !(pergunta.path("max").isNumber() && valor.compareTo(pergunta.path("max").decimalValue()) > 0);
    }
}
