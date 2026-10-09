package br.com.treinos.api.atualizacoes;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;
class RegrasAtualizacaoTest {
    @Test void fasesNasBordasENovoPrazo() {
        var data = LocalDate.of(2026, 10, 10);
        assertThat(RegrasAtualizacao.calcular(data, null, null, null).fase()).isEqualTo("NENHUMA");
        for (int antes : new int[]{4,3,2,1,0,-1}) {
            String fase = antes > 3 ? "NENHUMA" : antes > 1 ? "AVISO" : antes >= 0 ? "ABERTA" : "ATRASADA";
            assertThat(RegrasAtualizacao.calcular(data.minusDays(antes), data, null, null).fase()).isEqualTo(fase);
        }
        // Com aviso de atraso: abre pela data original e só atrasa depois da nova data.
        assertThat(RegrasAtualizacao.calcular(data.minusDays(1), data, data.plusDays(5), null).fase()).isEqualTo("ABERTA");
        assertThat(RegrasAtualizacao.calcular(data.plusDays(1), data, data.plusDays(3), null).fase()).isEqualTo("ABERTA");
        assertThat(RegrasAtualizacao.calcular(data.plusDays(3), data, data.plusDays(3), null).fase()).isEqualTo("ABERTA");
        assertThat(RegrasAtualizacao.calcular(data.plusDays(1), data, data.plusDays(3), null).diasDeAtraso()).isZero();
        assertThat(RegrasAtualizacao.calcular(data.minusDays(5), data, data.plusDays(3), null).fase()).isEqualTo("NENHUMA");
        // Nova data anterior à original (gravada antes da regra) não antecipa nada.
        assertThat(RegrasAtualizacao.calcular(data.plusDays(1), data, data.minusDays(2), null).fase()).isEqualTo("ATRASADA");
        assertThat(RegrasAtualizacao.calcular(data.plusDays(4), data, data.plusDays(3), null).diasDeAtraso()).isEqualTo(1);
        assertThat(RegrasAtualizacao.calcular(data.plusDays(10), data, null, "ENVIADA").fase()).isEqualTo("ENVIADA");
        assertThat(RegrasAtualizacao.calcular(data, data, null, "REVISADA").fase()).isEqualTo("REVISADA");
    }
    @Test void novaDataDoAtrasoFicaEntreADataEQuinzeDiasDepois() {
        var data = LocalDate.of(2026, 10, 10);
        var hoje = data.minusDays(1);
        assertThat(RegrasAtualizacao.novaDataValida(hoje, data, data.minusDays(1))).isFalse();
        assertThat(RegrasAtualizacao.novaDataValida(hoje, data, data)).isTrue();
        assertThat(RegrasAtualizacao.novaDataValida(hoje, data, data.plusDays(15))).isTrue();
        assertThat(RegrasAtualizacao.novaDataValida(hoje, data, data.plusDays(16))).isFalse();
        assertThat(RegrasAtualizacao.novaDataValida(data.plusDays(3), data, data.plusDays(2))).isFalse();
        assertThat(RegrasAtualizacao.novaDataValida(data.plusDays(3), data, data.plusDays(3))).isTrue();
    }
}
