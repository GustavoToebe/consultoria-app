package br.com.treinos.api.vitrine;

import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** D4: o preço que vale hoje é função pura do dia de Brasília. */
class PrecoDaVitrineTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 16);

    @Test
    void especialValeAteOFimDoDiaDaValidadeInclusive() {
        assertThat(PrecoDaVitrine.vigente(10_000L, 8_000L, HOJE.plusDays(1), HOJE)).isEqualTo(8_000L);
        assertThat(PrecoDaVitrine.vigente(10_000L, 8_000L, HOJE, HOJE)).isEqualTo(8_000L);
        assertThat(PrecoDaVitrine.vigente(10_000L, 8_000L, HOJE.minusDays(1), HOJE)).isEqualTo(10_000L);
    }

    @Test
    void especialSemDataNaoTemFim() {
        assertThat(PrecoDaVitrine.vigente(10_000L, 8_000L, null, HOJE)).isEqualTo(8_000L);
        assertThat(PrecoDaVitrine.especialVigente(8_000L, null, HOJE.plusYears(30))).isTrue();
    }

    @Test
    void semEspecialValeOPrecoNormal() {
        assertThat(PrecoDaVitrine.vigente(10_000L, null, null, HOJE)).isEqualTo(10_000L);
        assertThat(PrecoDaVitrine.especialVigente(null, HOJE.plusDays(5), HOJE)).isFalse();
    }

    @Test
    void semPrecoNaoHaPrecoENuncaZero() {
        assertThat(PrecoDaVitrine.vigente(null, null, null, HOJE)).isNull();
    }

    /** O "hoje" é o de Brasília: 23h de Brasília ainda é o dia, mesmo já sendo o dia seguinte em UTC. */
    @Test
    void viradaDoDiaEmBrasilia() {
        LocalDate dia = LocalDate.of(2026, 11, 16);
        ZonedDateTime vinteTresEmBrasilia = ZonedDateTime.of(2026, 11, 16, 23, 30, 0, 0, Fuso.BRASILIA);
        assertThat(vinteTresEmBrasilia.withZoneSameInstant(ZoneOffset.UTC).toLocalDate()).isEqualTo(dia.plusDays(1));
        LocalDate hojeEmBrasilia = vinteTresEmBrasilia.toLocalDate();
        assertThat(PrecoDaVitrine.especialVigente(8_000L, dia, hojeEmBrasilia)).isTrue();
        assertThat(PrecoDaVitrine.especialVigente(8_000L, dia, hojeEmBrasilia.plusDays(1))).isFalse();
    }
}
