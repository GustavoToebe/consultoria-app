package br.com.treinos.api.treino;

import br.com.treinos.api.treino.ConteudoTreino.Cardio;
import br.com.treinos.api.treino.ConteudoTreino.ModoDeCardio;
import br.com.treinos.api.treino.ConteudoTreino.ProtocoloDeCardio;
import br.com.treinos.api.treino.ConteudoTreino.TipoDeRecuperacao;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O contínuo e o dado antigo saem com as mesmas cinco chaves de antes: o pacote offline do app instalado confere as chaves
 * do cardio de forma estrita ({@code formatoDoPacote}). Só o intervalado novo traz as chaves novas (D2, D3 e D16 do
 * {@code docs/planos/cardio-e-hiit.md}).
 */
class CardioJsonTest {

    private static final List<String> CHAVES_DE_ANTES = List.of("duracaoMin", "distanciaKm", "ritmo", "zona", "intervalos");

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void continuoEIntervaladoAntigoSaemSoComAsChavesDeAntes() throws Exception {
        for (Cardio c : List.of(new Cardio(30, null, null, 2, null),
                new Cardio(null, null, null, 4, new Cardio.Intervalos(30, 60, 8)))) {
            JsonNode no = json.readTree(json.writeValueAsString(c));
            assertThat(no.propertyNames()).containsExactlyElementsOf(CHAVES_DE_ANTES);
        }
        // Corpo de antes (sem as chaves novas) continua sendo lido.
        assertThat(json.readValue("{\"duracaoMin\":30,\"distanciaKm\":null,\"ritmo\":null,\"zona\":2,\"intervalos\":null}",
                Cardio.class)).isEqualTo(new Cardio(30, null, null, 2, null));
    }

    @Test
    void intervaladoNovoIdaEVoltaEEsforcoMaximoFalseSome() throws Exception {
        Cardio sit = new Cardio(null, null, null, null, new Cardio.Intervalos(30, 180, 6), ModoDeCardio.INTERVALADO,
                ProtocoloDeCardio.SIT, 240, 180, TipoDeRecuperacao.PASSIVA, true);
        String texto = json.writeValueAsString(sit);
        assertThat(texto).contains("\"modo\":\"INTERVALADO\"", "\"protocolo\":\"SIT\"", "\"aquecimentoSeg\":240",
                "\"desaquecimentoSeg\":180", "\"recuperacaoTipo\":\"PASSIVA\"", "\"esforcoMaximo\":true");
        assertThat(json.readValue(texto, Cardio.class)).isEqualTo(sit);

        Cardio lido = json.readValue("{\"modo\":\"INTERVALADO\",\"zona\":5,\"esforcoMaximo\":false,"
                + "\"intervalos\":{\"trabalhoSeg\":30,\"descansoSeg\":30,\"voltas\":10}}", Cardio.class);
        assertThat(lido.esforcoMaximo()).isNull();
        assertThat(json.writeValueAsString(lido)).doesNotContain("esforcoMaximo");
    }
}
