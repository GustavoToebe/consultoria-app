package br.com.treinos.api.privacidade;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class TextoLivreDosPlanosTest {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void tiraOTextoLivreEmQualquerNivelEMantemOResto() {
        JsonNode antes = json.readTree("""
                {"objetivo":"Meta fictícia","orientacoes":"Texto fictício","sessoes":[
                  {"uid":"s1","nome":"Segunda - Costas","observacao":"Obs fictícia","cardio":"20 min","exercicios":[
                    {"uid":"e1","nome":"Remada","videoUrl":"https://exemplo.test/v","observacao":"Dor fictícia","series":[
                      {"uid":"x1","tipo":"FEEDER","repsMin":3,"repsMax":6,"descansoSegundos":90,
                       "carga":{"modo":"PERCENTUAL_WS","percentualMin":85,"percentualMax":90},
                       "esforco":{"rir":1},"alvoExtra":"Alvo fictício",
                       "tecnica":{"tipo":"CLUSTER","blocos":[4,2],"pausaSegundos":15}},
                      {"uid":"x2","cardio":{"duracaoMin":30,"ritmo":"6:00/km","zona":2}}]}]}],
                 "metodologia":{"nome":"Metodologia da consultoria","configuracao":{"observacao":"da consultoria"}},
                 "secoes":[{"uid":"m1","titulo":"Quadril","itens":[{"uid":"i1","nome":"Alongamento","prescricao":"2x30s"}]}]}
                """);
        JsonNode depois = TextoLivreDosPlanos.limpar(antes);

        assertThat(depois.path("objetivo").isNull()).isTrue();
        assertThat(depois.path("orientacoes").isNull()).isTrue();
        JsonNode sessao = depois.path("sessoes").get(0);
        assertThat(sessao.path("observacao").isNull()).isTrue();
        assertThat(sessao.path("cardio").isNull()).isTrue();
        assertThat(sessao.path("nome").asString()).isEqualTo("Segunda - Costas");
        JsonNode exercicio = sessao.path("exercicios").get(0);
        assertThat(exercicio.path("observacao").isNull()).isTrue();
        assertThat(exercicio.path("videoUrl").asString()).isEqualTo("https://exemplo.test/v");
        // A série é número e código de tipo: só o alvo extra (texto do treinador) sai.
        JsonNode serie = exercicio.path("series").get(0);
        assertThat(serie.path("alvoExtra").isNull()).isTrue();
        assertThat(serie.path("tipo").asString()).isEqualTo("FEEDER");
        assertThat(serie.path("carga").path("percentualMin").asInt()).isEqualTo(85);
        assertThat(serie.path("esforco").path("rir").asInt()).isEqualTo(1);
        // No cardio da série, o ritmo (texto livre) sai e duração e zona ficam.
        JsonNode cardio = exercicio.path("series").get(1).path("cardio");
        assertThat(cardio.path("ritmo").isNull()).isTrue();
        assertThat(cardio.path("duracaoMin").asInt()).isEqualTo(30);
        assertThat(cardio.path("zona").asInt()).isEqualTo(2);
        assertThat(serie.path("tecnica").path("blocos").size()).isEqualTo(2);
        assertThat(depois.path("secoes").get(0).path("itens").get(0).path("prescricao").isNull()).isTrue();
        assertThat(depois.path("secoes").get(0).path("itens").get(0).path("nome").asString()).isEqualTo("Alongamento");
        // A metodologia é da consultoria e passa intacta; o original não é alterado.
        assertThat(depois.path("metodologia")).isEqualTo(antes.path("metodologia"));
        assertThat(antes.path("objetivo").asString()).isEqualTo("Meta fictícia");
    }

    @Test
    void valorQueNaoETextoNaoMuda() {
        JsonNode antes = json.readTree("{\"texto\":{\"a\":1},\"notas\":null,\"lista\":[1,\"b\"]}");
        assertThat(TextoLivreDosPlanos.limpar(antes)).isEqualTo(antes);
    }
}
