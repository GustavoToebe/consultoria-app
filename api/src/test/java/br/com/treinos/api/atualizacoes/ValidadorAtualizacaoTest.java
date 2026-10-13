package br.com.treinos.api.atualizacoes;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import br.com.treinos.api.questionarios.LimitesQuestionario;
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

    private tools.jackson.databind.JsonNode modeloNovo() {
        return json.readTree("{\"secoes\":[{\"perguntas\":["
            + "{\"id\":\"e\",\"tipo\":\"ESCOLHA_UNICA\",\"opcoes\":[{\"id\":\"a\",\"rotulo\":\"A\"},{\"id\":\"b\",\"rotulo\":\"B\"}]},"
            + "{\"id\":\"m\",\"tipo\":\"MULTIPLA_ESCOLHA\",\"opcoes\":[{\"id\":\"a\",\"rotulo\":\"A\"},{\"id\":\"b\",\"rotulo\":\"B\"}]},"
            + "{\"id\":\"n\",\"tipo\":\"NUMERO\",\"min\":0,\"max\":10,\"casas\":1},"
            + "{\"id\":\"s\",\"tipo\":\"SIM_NAO\"}]}]}");
    }

    @Test void guardaOsTiposNovosComoVieram() {
        var resp = json.readTree("{\"e\":\"a\",\"m\":[\"a\",\"b\"],\"n\":2.5,\"s\":false}");
        assertThat(validador.validar(modeloNovo(), resp)).isEqualTo(resp);
    }

    @Test void listaVaziaEBrancoContamComoNaoRespondidos() {
        var limpas = validador.validar(modeloNovo(), json.readTree("{\"e\":\"\",\"m\":[]}"));
        assertThat(limpas.isEmpty()).isTrue();
    }

    @Test void recusaTiposNovosForaDoContrato() {
        for (String ruim : new String[] {"{\"e\":\"z\"}", "{\"m\":[\"a\",\"a\"]}", "{\"m\":\"a\"}", "{\"n\":11}", "{\"n\":2.25}", "{\"n\":\"2\"}", "{\"s\":\"sim\"}"}) {
            assertThatThrownBy(() -> validador.validar(modeloNovo(), json.readTree(ruim))).as(ruim).isInstanceOf(ValidacaoException.class);
        }
    }

    @Test void tetoDeRespostasEDe256KibEmBytes() {
        var modelo = json.readTree("{\"secoes\":[{\"perguntas\":[{\"id\":\"t\",\"tipo\":\"TEXTO\"}]}]}");
        // {"x":"..."} = 8 bytes de moldura + o texto; ajusta para ficar exatamente no limite e 1 byte acima.
        int moldura = "{\"x\":\"\"}".length();
        String no = "a".repeat(LimitesQuestionario.RESPOSTAS_BYTES - moldura);
        assertThat(validador.validar(modelo, json.valueToTree(Map.of("x", no)))).isNotNull();
        assertThatThrownBy(() -> validador.validar(modelo, json.valueToTree(Map.of("x", no + "a"))))
            .isInstanceOf(ValidacaoException.class).extracting(e -> ((ValidacaoException) e).getProblemas().get(0).field()).isEqualTo("respostas");
        // "ã" ocupa 2 bytes: a metade dos caracteres já passa do teto.
        String multibyte = "ã".repeat(LimitesQuestionario.RESPOSTAS_BYTES / 2);
        assertThatThrownBy(() -> validador.validar(modelo, json.valueToTree(Map.of("x", multibyte)))).isInstanceOf(ValidacaoException.class);
    }

    @Test void tipoDesconhecidoRespondidoEErro() {
        var modelo = json.readTree("{\"secoes\":[{\"perguntas\":[{\"id\":\"x\",\"tipo\":\"NOVO\"}]}]}");
        assertThat(validador.validar(modelo, json.createObjectNode()).isEmpty()).isTrue();
        assertThatThrownBy(() -> validador.validar(modelo, json.readTree("{\"x\":\"a\"}"))).isInstanceOf(ValidacaoException.class);
    }
}
