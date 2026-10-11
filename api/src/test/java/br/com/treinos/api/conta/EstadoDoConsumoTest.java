package br.com.treinos.api.conta;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EstadoDoConsumoTest {
    @Test
    void semLimiteNaoInventaZero() {
        assertThat(EstadoDoConsumo.de(0, null)).isEqualTo(EstadoDoConsumo.SEM_LIMITE_CONFIGURADO);
        assertThat(EstadoDoConsumo.de(999, null)).isEqualTo(EstadoDoConsumo.SEM_LIMITE_CONFIGURADO);
    }

    @Test
    void faixasDoLimite() {
        assertThat(EstadoDoConsumo.de(0, 150L)).isEqualTo(EstadoDoConsumo.DISPONIVEL);
        assertThat(EstadoDoConsumo.de(119, 150L)).isEqualTo(EstadoDoConsumo.DISPONIVEL);
        assertThat(EstadoDoConsumo.de(120, 150L)).isEqualTo(EstadoDoConsumo.ATENCAO);
        assertThat(EstadoDoConsumo.de(149, 150L)).isEqualTo(EstadoDoConsumo.ATENCAO);
        assertThat(EstadoDoConsumo.de(150, 150L)).isEqualTo(EstadoDoConsumo.ATINGIDO);
        assertThat(EstadoDoConsumo.de(151, 150L)).isEqualTo(EstadoDoConsumo.EXCEDIDO);
    }

    @Test
    void limitePequenoArredondaAtencaoParaCima() {
        // 80% de 5 = 4: com 4 já é atenção; com 3 ainda é disponível.
        assertThat(EstadoDoConsumo.de(3, 5L)).isEqualTo(EstadoDoConsumo.DISPONIVEL);
        assertThat(EstadoDoConsumo.de(4, 5L)).isEqualTo(EstadoDoConsumo.ATENCAO);
    }

    @Test
    void limiteZero() {
        assertThat(EstadoDoConsumo.de(0, 0L)).isEqualTo(EstadoDoConsumo.ATINGIDO);
        assertThat(EstadoDoConsumo.de(1, 0L)).isEqualTo(EstadoDoConsumo.EXCEDIDO);
    }
}
