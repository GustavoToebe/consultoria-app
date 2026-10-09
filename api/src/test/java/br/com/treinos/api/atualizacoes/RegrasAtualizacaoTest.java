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
        assertThat(RegrasAtualizacao.calcular(data.plusDays(1), data, data.plusDays(3), null).fase()).isEqualTo("AVISO");
        assertThat(RegrasAtualizacao.calcular(data.plusDays(4), data, data.plusDays(3), null).diasDeAtraso()).isEqualTo(1);
        assertThat(RegrasAtualizacao.calcular(data.plusDays(10), data, null, "ENVIADA").fase()).isEqualTo("ENVIADA");
        assertThat(RegrasAtualizacao.calcular(data, data, null, "REVISADA").fase()).isEqualTo("REVISADA");
    }
}
