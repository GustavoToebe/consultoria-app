package br.com.treinos.api.demo;

import br.com.treinos.api.treino.ConteudoTreino.Serie;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** A notação do Plano 16 vira séries no contrato novo: técnica na própria série de trabalho, esforço à parte. */
class SeedDemoNotacaoTest {

    @Test
    void tiposPorCodigoComCargaDoTipo() {
        Serie aquecimento = SeedDemo.serie("A10-15");
        assertThat(aquecimento.tipo()).isEqualTo("WARM_UP");
        assertThat(aquecimento.modo()).isEqualTo("NENHUMA");
        Serie fs = SeedDemo.serie("F3@85-90");
        assertThat(fs.tipo()).isEqualTo("FEEDER");
        assertThat(fs.carga().modo()).isEqualTo("PERCENTUAL_WS");
        assertThat(fs.carga().percentualMin()).isEqualByComparingTo("85");
        assertThat(fs.carga().percentualMax()).isEqualByComparingTo("90");
        assertThat(fs.repsMin()).isEqualTo(3);
        Serie ws = SeedDemo.serie("W3-6");
        assertThat(ws.tipo()).isEqualTo("WORKING");
        assertThat(ws.deTrabalho()).isTrue();
        Serie backOff = SeedDemo.serie("B6-8@85");
        assertThat(backOff.tipo()).isEqualTo("BACK_OFF");
        assertThat(backOff.carga().percentualMin()).isEqualByComparingTo("85");
    }

    @Test
    void topSetEAcimaDaAnteriorSemRepeticoes() {
        Serie top = SeedDemo.serie("T@1-5");
        assertThat(top.tipo()).isEqualTo("TOP_SET");
        assertThat(top.carga().modo()).isEqualTo("ACIMA_DA_ANTERIOR");
        assertThat(top.carga().percentualMin()).isEqualByComparingTo("1");
        assertThat(top.carga().percentualMax()).isEqualByComparingTo("5");
        assertThat(top.repsMin()).isNull();
    }

    @Test
    void restPauseEClusterViramAPropriaSerieDeTrabalho() {
        Serie restPause = SeedDemo.serie("R6:2@15");
        assertThat(restPause.tipo()).isEqualTo("WORKING");
        assertThat(restPause.deTrabalho()).isTrue();
        assertThat(restPause.tecnica().tipo()).isEqualTo("REST_PAUSE");
        assertThat(restPause.tecnica().pausas()).isEqualTo(2);
        assertThat(restPause.tecnica().pausaSegundos()).isEqualTo(15);
        assertThat(restPause.repsMin()).isEqualTo(6);

        Serie cluster = SeedDemo.serie("C4+2@15");
        assertThat(cluster.tipo()).isEqualTo("WORKING");
        assertThat(cluster.deTrabalho()).isTrue();
        assertThat(cluster.tecnica().tipo()).isEqualTo("CLUSTER");
        assertThat(cluster.tecnica().blocos()).containsExactly(4, 2);
        assertThat(cluster.repsMin()).isEqualTo(6).isEqualTo(cluster.repsMax());

        Serie muscleRound = SeedDemo.serie("M3x2@5r/10");
        assertThat(muscleRound.tecnica().blocos()).containsExactly(2, 2, 2);
        assertThat(muscleRound.tecnica().pausaRespiracoes()).isEqualTo(5);
        assertThat(muscleRound.tecnica().pausaSegundos()).isEqualTo(10);
        assertThat(muscleRound.repsMin()).isEqualTo(6);
    }

    @Test
    void maisRAcrescentaORestPauseNaSerieAnterior() {
        Serie ws = SeedDemo.serie("W3-6+R1@20");
        assertThat(ws.tipo()).isEqualTo("WORKING");
        assertThat(ws.repsMin()).isEqualTo(3);
        assertThat(ws.repsMax()).isEqualTo(6);
        assertThat(ws.carga().modo()).isEqualTo("CARGA_TRABALHO");
        assertThat(ws.tecnica().tipo()).isEqualTo("REST_PAUSE");
        assertThat(ws.tecnica().pausaSegundos()).isEqualTo(20);
    }
}
