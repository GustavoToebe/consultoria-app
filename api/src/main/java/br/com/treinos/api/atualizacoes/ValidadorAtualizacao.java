package br.com.treinos.api.atualizacoes;
import br.com.treinos.api.web.ApiError;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/** Devolve só respostas conhecidas. Mensagens nunca repetem o valor sensível enviado. */
@Component
public class ValidadorAtualizacao {
    private final JsonMapper json;
    public ValidadorAtualizacao(JsonMapper json) { this.json = json; }
    public JsonNode validar(JsonNode modelo, JsonNode respostas) {
        var erros = new ArrayList<ApiError.FieldError>();
        var limpas = json.createObjectNode();
        if (respostas == null || !respostas.isObject() || json.writeValueAsString(respostas).getBytes(StandardCharsets.UTF_8).length > 65536)
            throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", java.util.List.of(new ApiError.FieldError("respostas", "Respostas inválidas ou acima do limite.")));
        for (var secao : modelo.path("secoes")) for (var p : secao.path("perguntas")) {
            String id = p.path("id").asString(); String tipo = p.path("tipo").asString();
            if ("FOTOS".equals(tipo) || "DATA_AUTOMATICA".equals(tipo)) continue;
            var v = respostas.path(id);
            boolean vazio = v.isMissingNode() || v.isNull() || (v.isString() && v.asString().isBlank());
            if (vazio) { if (p.path("obrigatoria").asBoolean(false)) erros.add(new ApiError.FieldError(id, "Preencha este campo.")); continue; }
            boolean valido = switch (tipo) {
                case "NOTA" -> nota(v);
                case "PESO" -> v.isNumber() && v.asDouble() >= 20 && v.asDouble() <= 400 && v.decimalValue().stripTrailingZeros().scale() <= 1;
                case "TEXTO", "TEXTO_LONGO" -> v.isString() && v.asString().length() <= ("TEXTO".equals(tipo) ? 500 : 2000);
                case "NOTAS_POR_DIA" -> v.isObject() && v.properties().stream().allMatch(e ->
                    p.path("dias").valueStream().anyMatch(d -> String.valueOf(d.asInt()).equals(e.getKey())) && (e.getValue().isNull() || nota(e.getValue())));
                default -> false;
            };
            if (!valido) erros.add(new ApiError.FieldError(id, "Confira o formato e os limites deste campo."));
            else limpas.set(id, v);
        }
        if (!erros.isEmpty()) throw new ValidacaoException("Confira as respostas.", "ATUALIZACAO_INVALIDA", erros);
        return limpas;
    }
    private static boolean nota(JsonNode v) { return v.isIntegralNumber() && v.asLong() >= 0 && v.asLong() <= 10; }
}
