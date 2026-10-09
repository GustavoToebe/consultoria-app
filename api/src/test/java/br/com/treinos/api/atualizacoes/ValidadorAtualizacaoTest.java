package br.com.treinos.api.atualizacoes;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import br.com.treinos.api.web.ValidacaoException;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
class ValidadorAtualizacaoTest {
    private final JsonMapper json = JsonMapper.builder().build();
    private final ValidadorAtualizacao validador = new ValidadorAtualizacao(json);
    private tools.jackson.databind.JsonNode modelo() {
        return json.readTree("{\"secoes\":[{\"perguntas\":[{\"id\":\"peso\",\"tipo\":\"PESO\",\"obrigatoria\":true},{\"id\":\"sono\",\"tipo\":\"NOTA\",\"obrigatoria\":true},{\"id\":\"texto\",\"tipo\":\"TEXTO\"},{\"id\":\"dias\",\"tipo\":\"NOTAS_POR_DIA\",\"dias\":[1,2]}]}]}");
    }
    @Test void limpaDesconhecidosEConfereObrigatoriosSemExporValores() {
        var validas = validador.validar(modelo(), json.valueToTree(Map.of("peso", 80.5, "sono", 0, "desconhecido", "segredo")));
        assertThat(validas.has("desconhecido")).isFalse();
        assertThatThrownBy(() -> validador.validar(modelo(), json.valueToTree(Map.of("peso", 0, "sono", 11, "texto", "x".repeat(501)))))
            .isInstanceOf(ValidacaoException.class).hasMessage("Confira as respostas.");
        assertThatThrownBy(() -> validador.validar(modelo(), json.createObjectNode())).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> validador.validar(modelo(), json.valueToTree(Map.of("peso", 80.55, "sono", 1)))).isInstanceOf(ValidacaoException.class);
    }
}
