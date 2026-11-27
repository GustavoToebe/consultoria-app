package br.com.treinos.api.atualizacoes;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import br.com.treinos.api.questionarios.LimitesQuestionario;
import br.com.treinos.api.web.ValidacaoException;
import java.time.LocalDate;
import java.util.List;
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

    @Test void numeroGiganteOuInfinitoEh422NuncaErroInterno() {
        // 1e400 vira infinito no JSON e não pode derrubar o envio.
        assertThatThrownBy(() -> validador.validar(modeloNovo(), json.readTree("{\"n\":1e400}"))).isInstanceOf(ValidacaoException.class);
        var semLimite = json.readTree("{\"secoes\":[{\"perguntas\":[{\"id\":\"n\",\"tipo\":\"NUMERO\"}]}]}");
        assertThat(validador.validar(semLimite, json.readTree("{\"n\":5}")).path("n").asInt()).isEqualTo(5);
        assertThatThrownBy(() -> validador.validar(semLimite, json.readTree("{\"n\":1000000001}"))).isInstanceOf(ValidacaoException.class);
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

    @Test void fotosComLugaresAceitamUmaPorLugarNaOrdemDaResposta() {
        var modelo = json.readTree("{\"secoes\":[{\"perguntas\":[{\"id\":\"f\",\"tipo\":\"FOTOS\",\"max\":6,\"lugares\":[\"Frente\",\"Costas\"]}]}]}");
        String a = "00000000-0000-4000-8000-000000000001", b = "00000000-0000-4000-8000-000000000002", c = "00000000-0000-4000-8000-000000000003";
        var duas = json.readTree("{\"f\":[\"" + b + "\",\"" + a + "\"]}");
        assertThat(validador.validar(modelo, duas, true)).isEqualTo(duas);
        var tres = json.readTree("{\"f\":[\"" + a + "\",\"" + b + "\",\"" + c + "\"]}");
        assertThatThrownBy(() -> validador.validar(modelo, tres, true)).isInstanceOf(ValidacaoException.class)
            .extracting(e -> ((ValidacaoException) e).getProblemas().get(0).field()).isEqualTo("f");
    }

    @Test void tipoDesconhecidoRespondidoEErro() {
        var modelo = json.readTree("{\"secoes\":[{\"perguntas\":[{\"id\":\"x\",\"tipo\":\"NOVO\"}]}]}");
        assertThat(validador.validar(modelo, json.createObjectNode()).isEmpty()).isTrue();
        assertThatThrownBy(() -> validador.validar(modelo, json.readTree("{\"x\":\"a\"}"))).isInstanceOf(ValidacaoException.class);
    }

    // ---- ITENS_DO_PLANO (aspas simples nos JSON abaixo, trocadas por duplas em j()) ----

    private static final String FRANGO = "00000000-0000-4000-8000-0000000000a1";
    private static final String BATATA = "00000000-0000-4000-8000-0000000000a2";
    private static final String FRANGO_DA_OPCAO_B = "00000000-0000-4000-8000-0000000000a3";
    private static final ItensDoPlano LISTA = fonte -> "ALIMENTOS_DA_DIETA".equals(fonte) ? List.of(
            new ItensDoPlano.Item(FRANGO, "Frango grelhado"), new ItensDoPlano.Item(BATATA, "Batata-doce"),
            new ItensDoPlano.Item(FRANGO_DA_OPCAO_B, "frango  grelhado")) : List.of();

    private tools.jackson.databind.JsonNode j(String texto) {
        return json.readTree(texto.replace('\'', '"'));
    }

    private tools.jackson.databind.JsonNode modeloItens(String config) {
        return j("{'secoes':[{'perguntas':[{'id':'itens','tipo':'ITENS_DO_PLANO','fonte':'ALIMENTOS_DA_DIETA'" + config + "}]}]}");
    }

    private tools.jackson.databind.JsonNode itens(String config, String resposta) {
        return validador.validar(modeloItens(config), j("{'itens':" + resposta + "}"), false, "ATUALIZACAO_INVALIDA",
                LocalDate.of(2026, 11, 26), LISTA);
    }

    private void recusa(String config, String resposta) {
        assertThatThrownBy(() -> itens(config, resposta)).as(resposta).isInstanceOf(ValidacaoException.class)
            .extracting(e -> ((ValidacaoException) e).getProblemas().get(0).field()).isEqualTo("itens");
    }

    private static String escolhido(String id) {
        return "{'id':'" + id + "'}";
    }

    private static String escolhido(String id, String motivo) {
        return "{'id':'" + id + "','motivo':'" + motivo + "'}";
    }

    @Test void itensDoPlanoGravamONomeDaListaEOMotivoSemEspacos() {
        var gravado = itens(",'motivo':'OPCIONAL'", "[" + escolhido(FRANGO, "  enjoei  ") + "," + escolhido(BATATA, "   ") + "]").path("itens");
        assertThat(gravado.size()).isEqualTo(2);
        assertThat(gravado.get(0).path("id").asString()).isEqualTo(FRANGO);
        assertThat(gravado.get(0).path("nome").asString()).isEqualTo("Frango grelhado");
        assertThat(gravado.get(0).path("motivo").asString()).isEqualTo("enjoei");
        assertThat(gravado.get(1).has("motivo")).isFalse();
        assertThat(gravado.get(1).path("nome").asString()).isEqualTo("Batata-doce");
    }

    @Test void itensDoPlanoRecusamForaDoContrato() {
        String opcional = ",'motivo':'OPCIONAL'";
        recusa("", "'texto'");
        recusa("", "['" + FRANGO + "']");
        recusa("", "[{'id':'" + FRANGO + "','nome':'Nome do cliente'}]");
        recusa("", "[{'id':'" + FRANGO + "','extra':1}]");
        recusa("", "[{'nome':'sem id'}]");
        recusa("", "[{'id':7}]");
        recusa("", "[" + escolhido("00000000-0000-4000-8000-0000000000ff") + "]");
        recusa("", "[" + escolhido(FRANGO) + "," + escolhido(FRANGO) + "]");
        // dois uids com o mesmo nome (caixa e espaços) contam como o mesmo item
        recusa("", "[" + escolhido(FRANGO) + "," + escolhido(FRANGO_DA_OPCAO_B) + "]");
        recusa(",'max':1", "[" + escolhido(FRANGO) + "," + escolhido(BATATA) + "]");
        recusa(opcional, "[{'id':'" + FRANGO + "','motivo':7}]");
        recusa(opcional, "[" + escolhido(FRANGO, "a".repeat(301)) + "]");
        recusa(",'motivo':'OBRIGATORIO'", "[" + escolhido(FRANGO) + "]");
        recusa(",'motivo':'OBRIGATORIO'", "[" + escolhido(FRANGO, "  ") + "]");
        recusa("", "[" + escolhido(FRANGO, "sem pedir") + "]");
        recusa(",'motivo':'TALVEZ'", "[" + escolhido(FRANGO) + "]");
    }

    @Test void itensDoPlanoAceitamOLimiteDoMotivoEOMaximoDaPergunta() {
        assertThat(itens(",'motivo':'OPCIONAL'", "[" + escolhido(FRANGO, "a".repeat(300)) + "]").path("itens").size()).isEqualTo(1);
        assertThat(itens(",'max':2", "[" + escolhido(FRANGO) + "," + escolhido(BATATA) + "]").path("itens").size()).isEqualTo(2);
    }

    @Test void itensDoPlanoSemListaOuSemRespostaSeguemAsRegrasDeSempre() {
        // sem contexto de plano (anamnese, inscrição), qualquer resposta é recusada
        assertThatThrownBy(() -> validador.validar(modeloItens(""), j("{'itens':[" + escolhido(FRANGO) + "]}")))
            .isInstanceOf(ValidacaoException.class);
        // lista vazia = não respondida: opcional passa, obrigatória recusa
        assertThat(itens("", "[]").has("itens")).isFalse();
        assertThatThrownBy(() -> itens(",'obrigatoria':true", "[]")).isInstanceOf(ValidacaoException.class);
    }

    @Test void mensagemDeRecusaDosItensNuncaRepeteOQueVeio() {
        var e = catchThrowableOfType(ValidacaoException.class, () -> itens(",'motivo':'OPCIONAL'",
            "[" + escolhido(FRANGO, "SEGREDO ".repeat(60)) + "]"));
        assertThat(e.getProblemas().toString()).doesNotContain("SEGREDO").doesNotContain("Frango").doesNotContain(FRANGO);
    }
}
