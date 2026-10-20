package br.com.treinos.api.pagamentos;

import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** O {@code valid_until} do link com chave: 30 dias depois do maior entre o vencimento e hoje, às 23:59:59 de Brasília. */
class ValidadeDoLinkTest {

    private static final Instant AGORA = ZonedDateTime.of(2026, 10, 20, 15, 30, 0, 0, Fuso.BRASILIA).toInstant();

    private static Instant fimDoDia(LocalDate dia) {
        return dia.atTime(23, 59, 59).atZone(Fuso.BRASILIA).toInstant();
    }

    @Test
    void vencimentoNoPassadoUsaHojeComoBase() {
        assertThat(LinkDePagamentoService.validadeDoLink(LocalDate.of(2026, 10, 1), AGORA))
                .isEqualTo(fimDoDia(LocalDate.of(2026, 11, 19)));
        assertThat(LinkDePagamentoService.validadeDoLink(LocalDate.of(2020, 1, 1), AGORA))
                .isEqualTo(fimDoDia(LocalDate.of(2026, 11, 19)));
    }

    @Test
    void vencimentoHojeUsaHoje() {
        assertThat(LinkDePagamentoService.validadeDoLink(LocalDate.of(2026, 10, 20), AGORA))
                .isEqualTo(fimDoDia(LocalDate.of(2026, 11, 19)));
    }

    @Test
    void vencimentoFuturoSomaOsTrintaDiasAoVencimento() {
        assertThat(LinkDePagamentoService.validadeDoLink(LocalDate.of(2026, 11, 5), AGORA))
                .isEqualTo(fimDoDia(LocalDate.of(2026, 12, 5)));
    }

    @Test
    void vencimentoMuitoLongeNuncaPassaDeAgoraMais364Dias() {
        Instant validade = LinkDePagamentoService.validadeDoLink(LocalDate.of(2030, 1, 1), AGORA);

        assertThat(validade).isEqualTo(AGORA.plus(364, ChronoUnit.DAYS));
        assertThat(validade.getNano()).isZero();
    }

    @Test
    void passadaAMeiaNoiteDeBrasiliaDeixaDeSerHojeMesmoEmUtcAindaSerOutroDia() {
        // 23:30 em Brasília de 20/10 já é 21/10 em UTC: "hoje" é o dia de Brasília.
        Instant tarde = ZonedDateTime.of(2026, 10, 20, 23, 30, 0, 0, Fuso.BRASILIA).toInstant();

        assertThat(LinkDePagamentoService.validadeDoLink(LocalDate.of(2026, 10, 1), tarde))
                .isEqualTo(fimDoDia(LocalDate.of(2026, 11, 19)));
    }

    @Test
    void semprePeloMenosTrintaDiasAFrenteEFuturo() {
        for (LocalDate vencimento : new LocalDate[] {LocalDate.of(2020, 1, 1), LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 21)}) {
            Instant validade = LinkDePagamentoService.validadeDoLink(vencimento, AGORA);
            assertThat(validade).isAfter(AGORA.plus(29, ChronoUnit.DAYS)).isBefore(AGORA.plus(365, ChronoUnit.DAYS));
        }
    }
}
