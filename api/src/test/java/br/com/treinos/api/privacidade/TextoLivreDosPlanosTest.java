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
                      {"uid":"x1","repsMin":3,"repsMax":6,"descansoSegundos":90,"alvoTexto":"até a falha",
                       "intensidade":{"modo":"LIVRE","percentual":50,"texto":"sentir leve"}}]}]}],
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
        JsonNode serie = exercicio.path("series").get(0);
        assertThat(serie.path("alvoTexto").isNull()).isTrue();
        assertThat(serie.path("intensidade").path("texto").isNull()).isTrue();
        assertThat(serie.path("uid").asString()).isEqualTo("x1");
        assertThat(serie.path("repsMin").asInt()).isEqualTo(3);
        assertThat(serie.path("repsMax").asInt()).isEqualTo(6);
        assertThat(serie.path("descansoSegundos").asInt()).isEqualTo(90);
        assertThat(serie.path("intensidade").path("percentual").asInt()).isEqualTo(50);
        assertThat(serie.path("intensidade").path("modo").asString()).isEqualTo("LIVRE");
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
