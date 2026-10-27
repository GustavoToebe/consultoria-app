package br.com.treinos.api.treino;

import br.com.treinos.api.treino.ConteudoTreino.CargaDaEtapa;
import br.com.treinos.api.treino.ConteudoTreino.Retomada;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Carga por bloco e retomadas (docs/series-etapas.md) saem do JSON quando nulas: o pacote salvo no aparelho é conferido
 * campo a campo ({@code formatoDoPacote} no app), e um app que ainda não os conhece não pode recusar o plano de sempre.
 */
class TecnicaJsonTest {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void camposDasEtapasSoAparecemQuandoPreenchidos() throws Exception {
        String semEtapas = json.writeValueAsString(Tecnica.cluster(List.of(4, 2), 15, null));
        assertThat(semEtapas).doesNotContain("cargasDosBlocos").doesNotContain("retomadas").contains("\"blocos\":[4,2]");

        Tecnica com = Tecnica.restPause(20, null, 1)
                .comRetomadas(List.of(new Retomada(2, 3, null, new CargaDaEtapa("PERCENTUAL_WS", 90))));
        String comEtapas = json.writeValueAsString(com);
        assertThat(comEtapas).contains("\"retomadas\":[{").contains("\"percentual\":90").doesNotContain("cargasDosBlocos");
        assertThat(json.readValue(comEtapas, Tecnica.class)).isEqualTo(com);
    }
}
