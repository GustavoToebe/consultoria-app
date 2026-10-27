package br.com.treinos.api.execucao;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.EtapaRegistrada;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Total e carga comum de uma série registrada por etapas (sem banco). */
class TotaisDasEtapasTest {

    private static EtapaRegistrada feita(int posicao, Integer reps, String carga) {
        return new EtapaRegistrada(posicao, reps, carga == null ? null : new BigDecimal(carga), "FEITA");
    }

    private static EtapaRegistrada naoRealizada(int posicao) {
        return new EtapaRegistrada(posicao, null, null, "NAO_REALIZADA");
    }

    @Test
    void totalSoComTodasAsEtapasEComRepeticoes() {
        List<EtapaRegistrada> todas = List.of(feita(1, 4, "40"), feita(2, 4, "40"), feita(3, 4, "40"), feita(4, 2, "40"));
        assertThat(SincronizacaoService.totalDasEtapas(todas, 4)).isEqualTo(14);
        // Parcial: a soma de uma parte não é o total.
        assertThat(SincronizacaoService.totalDasEtapas(todas.subList(0, 2), 4)).isNull();
        // Feita sem repetições informadas: não há total.
        assertThat(SincronizacaoService.totalDasEtapas(List.of(feita(1, 4, "40"), feita(2, null, "40")), 2)).isNull();
        // Não realizada entra como zero só porque não foi feita; zero informado é número.
        assertThat(SincronizacaoService.totalDasEtapas(List.of(feita(1, 0, "40"), naoRealizada(2)), 2)).isZero();
        assertThat(SincronizacaoService.totalDasEtapas(List.of(naoRealizada(1), naoRealizada(2)), 2)).isNull();
    }

    @Test
    void cargaComumSoQuandoTodasAsFeitasTemAMesmaCarga() {
        assertThat(SincronizacaoService.cargaComum(List.of(feita(1, 4, "40"), feita(2, 4, "40.00"), naoRealizada(3))))
                .isEqualByComparingTo("40");
        assertThat(SincronizacaoService.cargaComum(List.of(feita(1, 4, "40"), feita(2, 4, "35")))).isNull();
        assertThat(SincronizacaoService.cargaComum(List.of(feita(1, 4, "40"), feita(2, 4, null)))).isNull();
        assertThat(SincronizacaoService.cargaComum(List.of(naoRealizada(1)))).isNull();
    }
}
