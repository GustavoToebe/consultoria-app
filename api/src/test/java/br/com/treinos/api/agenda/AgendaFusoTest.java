package br.com.treinos.api.agenda;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

/** Sem banco: data e hora são sempre de Brasília, qualquer que seja o fuso da JVM. */
class AgendaFusoTest {

    @Test
    void horaDeBrasiliaViraOInstanteCertoMesmoComAJvmEmOutroFuso() {
        TimeZone anterior = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
            Instant inicio = AgendaService.inicioEmBrasilia(LocalDate.parse("2026-11-10"), LocalTime.parse("23:30"));
            assertThat(inicio).isEqualTo(Instant.parse("2026-11-11T02:30:00Z"));
            assertThat(AgendaService.data(inicio)).isEqualTo(LocalDate.parse("2026-11-10"));
            assertThat(AgendaService.hora(inicio)).isEqualTo("23:30");
            Instant fim = Compromisso.fimDe(inicio, 60);
            assertThat(AgendaService.data(fim)).isEqualTo(LocalDate.parse("2026-11-11"));
            assertThat(AgendaService.hora(fim)).isEqualTo("00:30");
        } finally {
            TimeZone.setDefault(anterior);
        }
    }

    @Test
    void segundosDaHoraSaoDescartados() {
        assertThat(AgendaService.inicioEmBrasilia(LocalDate.parse("2026-11-10"), LocalTime.parse("09:15:42")))
                .isEqualTo(Instant.parse("2026-11-10T12:15:00Z"));
    }

    @Test
    void canceladoNaoOcupaHorario() {
        assertThat(SituacaoCompromisso.CANCELADO.ocupaHorario()).isFalse();
        assertThat(SituacaoCompromisso.REALIZADO.ocupaHorario()).isTrue();
        assertThat(SituacaoCompromisso.FALTOU.ocupaHorario()).isTrue();
        assertThat(SituacaoCompromisso.AGENDADO.ocupaHorario()).isTrue();
    }
}
