package br.com.treinos.api.atencao;

import br.com.treinos.api.atencao.AvaliadorDeAtencao.Anterior;
import br.com.treinos.api.atencao.AvaliadorDeAtencao.Fato;
import br.com.treinos.api.atencao.AvaliadorDeAtencao.Regra;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/** O avaliador é puro e total: só fatos, operador inclusivo, a pergunta da anterior só com o mesmo id e tipo. */
class AvaliadorDeAtencaoTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static final String CONTEUDO = """
        {"formato":2,"secoes":[{"uid":"s1","perguntas":[
          {"id":"peso","tipo":"PESO","rotulo":"Peso"},
          {"id":"sono","tipo":"NOTA","rotulo":"Sono"},
          {"id":"fome","tipo":"NOTA","rotulo":"Fome"},
          {"id":"dor","tipo":"SIM_NAO","rotulo":"Dor"},
          {"id":"itens","tipo":"ITENS_DO_PLANO","rotulo":"Itens","fonte":"DIETA"},
          {"id":"obs","tipo":"TEXTO","rotulo":"Obs"}]}]}
        """;

    private static JsonNode j(String s) {
        return JSON.readTree(s);
    }

    private static Regra r(TipoDeRegra tipo, String pergunta, String limite) {
        return new Regra(tipo, pergunta, limite == null ? null : new BigDecimal(limite));
    }

    private static List<Fato> avaliar(String respostas, Anterior anterior, Long dias, Regra... regras) {
        return AvaliadorDeAtencao.avaliar(j(CONTEUDO), j(respostas), anterior, dias, Arrays.asList(regras));
    }

    private static Anterior anterior(String respostas) {
        return new Anterior(j(CONTEUDO), j(respostas));
    }

    private static BigDecimal n(String v) {
        return new BigDecimal(v);
    }

    @Test
    void notaAbaixoEInclusiva() {
        assertThat(avaliar("{\"sono\":5}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5")))
                .containsExactly(new Fato("NOTA_ABAIXO", "sono", n("5"), n("5")));
        assertThat(avaliar("{\"sono\":0}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"))).hasSize(1);
        assertThat(avaliar("{\"sono\":6}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"))).isEmpty();
        // Sem resposta, resposta de outro tipo, pergunta que não é NOTA ou que não existe: nada.
        assertThat(avaliar("{}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"))).isEmpty();
        assertThat(avaliar("{\"sono\":\"3\"}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"))).isEmpty();
        assertThat(avaliar("{\"sono\":true}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"))).isEmpty();
        assertThat(avaliar("{\"peso\":3}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "peso", "5"))).isEmpty();
        assertThat(avaliar("{\"sono\":3}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "inexistente", "5"))).isEmpty();
    }

    @Test
    void simSoComTrue() {
        assertThat(avaliar("{\"dor\":true}", null, null, r(TipoDeRegra.SIM, "dor", null)))
                .containsExactly(new Fato("SIM", "dor", null, null));
        assertThat(avaliar("{\"dor\":false}", null, null, r(TipoDeRegra.SIM, "dor", null))).isEmpty();
        assertThat(avaliar("{\"dor\":\"true\"}", null, null, r(TipoDeRegra.SIM, "dor", null))).isEmpty();
        assertThat(avaliar("{\"sono\":true}", null, null, r(TipoDeRegra.SIM, "sono", null))).isEmpty();
    }

    @Test
    void itemMarcadoComAoMenosUmItem() {
        assertThat(avaliar("{\"itens\":[{\"id\":\"a\",\"nome\":\"Arroz fictício\"}]}", null, null, r(TipoDeRegra.ITEM_MARCADO, "itens", null)))
                .containsExactly(new Fato("ITEM_MARCADO", "itens", null, null));
        assertThat(avaliar("{\"itens\":[]}", null, null, r(TipoDeRegra.ITEM_MARCADO, "itens", null))).isEmpty();
        assertThat(avaliar("{\"itens\":{\"id\":\"a\"}}", null, null, r(TipoDeRegra.ITEM_MARCADO, "itens", null))).isEmpty();
        assertThat(avaliar("{\"dor\":[1]}", null, null, r(TipoDeRegra.ITEM_MARCADO, "dor", null))).isEmpty();
    }

    @Test
    void notaCaiuUmFatoPorPerguntaComODeltaNegativo() {
        Anterior antes = anterior("{\"sono\":8,\"fome\":5}");
        assertThat(avaliar("{\"sono\":6,\"fome\":5}", antes, null, r(TipoDeRegra.NOTA_CAIU, null, "2")))
                .containsExactly(new Fato("NOTA_CAIU", "sono", n("2"), n("-2")));
        assertThat(avaliar("{\"sono\":2,\"fome\":1}", antes, null, r(TipoDeRegra.NOTA_CAIU, null, "2")))
                .extracting(Fato::perguntaId).containsExactly("sono", "fome");
        // Caiu 1 com limite 2; subiu: nada.
        assertThat(avaliar("{\"sono\":7,\"fome\":9}", antes, null, r(TipoDeRegra.NOTA_CAIU, null, "2"))).isEmpty();
    }

    @Test
    void notaCaiuEPesoMudouSemAnteriorOuComTipoTrocadoNaoGeramFato() {
        Regra caiu = r(TipoDeRegra.NOTA_CAIU, null, "1");
        Regra peso = r(TipoDeRegra.PESO_MUDOU, null, "1");
        assertThat(avaliar("{\"sono\":1,\"peso\":70}", null, null, caiu, peso)).isEmpty();
        // Na versão da anterior, "sono" era NUMERO e "peso" era NOTA: outra pergunta com o mesmo id.
        Anterior trocada = new Anterior(j("""
            {"secoes":[{"perguntas":[{"id":"sono","tipo":"NUMERO"},{"id":"peso","tipo":"NOTA"}]}]}"""), j("{\"sono\":9,\"peso\":90}"));
        assertThat(avaliar("{\"sono\":1,\"peso\":70}", trocada, null, caiu, peso)).isEmpty();
        // Anterior sem a resposta: nada.
        assertThat(avaliar("{\"sono\":1,\"peso\":70}", anterior("{}"), null, caiu, peso)).isEmpty();
    }

    @Test
    void pesoMudouPeloModuloEGuardaODeltaComSinalSemErroDeArredondamento() {
        Regra regra = r(TipoDeRegra.PESO_MUDOU, null, "0.1");
        assertThat(avaliar("{\"peso\":80.2}", anterior("{\"peso\":80.3}"), null, regra))
                .containsExactly(new Fato("PESO_MUDOU", "peso", n("0.1"), n("-0.1")));
        assertThat(avaliar("{\"peso\":82.5}", anterior("{\"peso\":80}"), null, r(TipoDeRegra.PESO_MUDOU, null, "2")))
                .containsExactly(new Fato("PESO_MUDOU", "peso", n("2"), n("2.5")));
        assertThat(avaliar("{\"peso\":81.9}", anterior("{\"peso\":80}"), null, r(TipoDeRegra.PESO_MUDOU, null, "2"))).isEmpty();
    }

    @Test
    void poucosTreinosEInclusivoEUsaOsDiasDoEnvio() {
        Regra regra = r(TipoDeRegra.POUCOS_TREINOS, null, "3");
        assertThat(avaliar("{}", null, 3L, regra)).containsExactly(new Fato("POUCOS_TREINOS", null, n("3"), n("3")));
        assertThat(avaliar("{}", null, 0L, regra)).hasSize(1);
        assertThat(avaliar("{}", null, 4L, regra)).isEmpty();
        assertThat(avaliar("{}", null, null, regra)).isEmpty();
    }

    @Test
    void semRegraNenhumFatoERegraRepetidaNaoDuplica() {
        assertThat(avaliar("{\"sono\":0,\"dor\":true}", null, 0L)).isEmpty();
        assertThat(AvaliadorDeAtencao.avaliar(j(CONTEUDO), j("{}"), null, 0L, null)).isEmpty();
        assertThat(avaliar("{\"sono\":1}", null, null, r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"), r(TipoDeRegra.NOTA_ABAIXO, "sono", "3")))
                .containsExactly(new Fato("NOTA_ABAIXO", "sono", n("5"), n("1")));
    }

    @Test
    void totalNuncaLancaComEntradaMalformada() {
        List<Regra> todas = new ArrayList<>(List.of(r(TipoDeRegra.NOTA_ABAIXO, "sono", "5"), r(TipoDeRegra.NOTA_CAIU, null, "1"),
                r(TipoDeRegra.SIM, "dor", null), r(TipoDeRegra.PESO_MUDOU, null, "1"), r(TipoDeRegra.POUCOS_TREINOS, null, "3"),
                r(TipoDeRegra.ITEM_MARCADO, "itens", null), r(TipoDeRegra.NOTA_ABAIXO, null, "5"), r(TipoDeRegra.NOTA_ABAIXO, "sono", null),
                new Regra(null, "sono", BigDecimal.ONE)));
        todas.add(null);
        for (String conteudo : new String[] {"null", "[]", "\"texto\"", "{\"secoes\":\"x\"}", "{\"secoes\":[{\"perguntas\":[1,null,{\"id\":2}]}]}"}) {
            for (String respostas : new String[] {"null", "[]", "7", "{\"sono\":{\"a\":1},\"peso\":[1],\"dor\":null,\"itens\":\"x\"}",
                "{\"sono\":1e400,\"peso\":-1e300}"}) {
                assertThatCode(() -> AvaliadorDeAtencao.avaliar(j(conteudo), j(respostas), new Anterior(j(conteudo), j(respostas)), 1L, todas))
                        .doesNotThrowAnyException();
                assertThatCode(() -> AvaliadorDeAtencao.avaliar(null, null, new Anterior(null, null), null, todas)).doesNotThrowAnyException();
            }
        }
        // Valor absurdo (não cabe na coluna) é ignorado.
        assertThat(avaliar("{\"peso\":1e7}", anterior("{\"peso\":80}"), null, r(TipoDeRegra.PESO_MUDOU, null, "1"))).isEmpty();
    }

    @Test
    void ordemDoQuestionarioEOPrimeiroIdVence() {
        JsonNode repetido = j("""
            {"secoes":[{"perguntas":[{"id":"sono","tipo":"NOTA"}]},{"perguntas":[{"id":"sono","tipo":"SIM_NAO"}]}]}""");
        assertThat(AvaliadorDeAtencao.avaliar(repetido, j("{\"sono\":true}"), null, null, List.of(r(TipoDeRegra.SIM, "sono", null)))).isEmpty();
        assertThat(AvaliadorDeAtencao.avaliar(repetido, j("{\"sono\":2}"), null, null, List.of(r(TipoDeRegra.NOTA_ABAIXO, "sono", "2"))))
                .hasSize(1);
    }
}
