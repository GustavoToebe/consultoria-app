package br.com.treinos.api.atualizacoes;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.treinos.api.web.ApiError;
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
    public JsonNode validar(JsonNode modelo, JsonNode respostas) {
        var erros = new ArrayList<ApiError.FieldError>();
        var limpas = json.createObjectNode();
        if (respostas == null || !respostas.isObject() || json.writeValueAsString(respostas).getBytes(StandardCharsets.UTF_8).length > LimitesQuestionario.RESPOSTAS_BYTES)
            throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", java.util.List.of(new ApiError.FieldError("respostas", "Respostas inválidas ou acima do limite.")));
        for (var secao : modelo.path("secoes")) for (var p : secao.path("perguntas")) {
            String id = p.path("id").asString(); String tipo = p.path("tipo").asString();
            if ("FOTOS".equals(tipo) || "DATA_AUTOMATICA".equals(tipo)) continue;
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
                default -> false;
            };
            if (!valido) erros.add(new ApiError.FieldError(id, "Confira o formato e os limites deste campo."));
            else limpas.set(id, v);
        }
        if (!erros.isEmpty()) throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", erros);
        return limpas;
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
