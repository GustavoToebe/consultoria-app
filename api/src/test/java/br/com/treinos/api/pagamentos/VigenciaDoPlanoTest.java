package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A vigência do plano, sem banco nem relógio: fim do ciclo em curso (exclusivo), dia 29/30/31 e alerta de renovação. */
class VigenciaDoPlanoTest {

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    private static VigenciaDoPlano de(String ancora, PeriodoDoPlano periodo, String hoje) {
        return VigenciaDoPlano.de(d(ancora), periodo, d(hoje), d(hoje));
    }

    private static void termina(String ancora, PeriodoDoPlano periodo, String hoje, String termino) {
        assertThat(CalendarioDeCobranca.fimDoCicloAtual(d(ancora), periodo, d(hoje)))
                .as("%s a partir de %s, hoje %s", periodo, ancora, hoje).isEqualTo(d(termino));
    }

    @Test
    void terminoEOFimDoCicloEmCursoParaCadaPeriodo() {
        // Antes do primeiro fim: âncora + 1 período, como sempre foi.
        termina("2027-01-15", PeriodoDoPlano.MENSAL, "2027-01-15", "2027-02-15");
        termina("2027-01-15", PeriodoDoPlano.MENSAL, "2027-02-14", "2027-02-15");
        termina("2027-01-15", PeriodoDoPlano.TRIMESTRAL, "2027-03-01", "2027-04-15");
        termina("2027-01-15", PeriodoDoPlano.SEMESTRAL, "2027-06-01", "2027-07-15");
        termina("2027-01-15", PeriodoDoPlano.ANUAL, "2027-12-31", "2028-01-15");
        // Depois do primeiro fim: avança de período em período.
        termina("2027-01-15", PeriodoDoPlano.MENSAL, "2027-04-20", "2027-05-15");
        termina("2027-01-15", PeriodoDoPlano.TRIMESTRAL, "2027-04-20", "2027-07-15");
        termina("2027-01-15", PeriodoDoPlano.SEMESTRAL, "2028-02-01", "2028-07-15");
        termina("2027-01-15", PeriodoDoPlano.ANUAL, "2028-02-15", "2029-01-15");
    }

    @Test
    void hojeExatamenteNoFimDoCicloJaEOCicloSeguinte() {
        termina("2027-01-15", PeriodoDoPlano.MENSAL, "2027-02-15", "2027-03-15");
        termina("2027-01-15", PeriodoDoPlano.TRIMESTRAL, "2027-04-15", "2027-07-15");
        termina("2027-01-15", PeriodoDoPlano.ANUAL, "2028-01-15", "2029-01-15");
        // O dia anterior ainda é o ciclo velho.
        termina("2027-01-15", PeriodoDoPlano.ANUAL, "2028-01-14", "2028-01-15");
    }

    @Test
    void ancoraNoDia29Ou30Ou31ContaDaAncoraEFicaNoUltimoDiaDoMes() {
        // Nunca encadeia datas: 31/01 -> 28/02 -> 31/03 (e não 28/03).
        termina("2027-01-31", PeriodoDoPlano.MENSAL, "2027-01-31", "2027-02-28");
        termina("2027-01-31", PeriodoDoPlano.MENSAL, "2027-02-28", "2027-03-31");
        termina("2027-01-31", PeriodoDoPlano.MENSAL, "2027-03-15", "2027-03-31");
        termina("2027-01-31", PeriodoDoPlano.MENSAL, "2027-04-30", "2027-05-31");
        termina("2027-01-30", PeriodoDoPlano.MENSAL, "2027-02-10", "2027-02-28");
        termina("2027-01-30", PeriodoDoPlano.MENSAL, "2027-03-01", "2027-03-30");
        termina("2027-01-29", PeriodoDoPlano.MENSAL, "2027-02-10", "2027-02-28");
        termina("2028-01-29", PeriodoDoPlano.MENSAL, "2028-02-10", "2028-02-29");
        termina("2027-08-31", PeriodoDoPlano.TRIMESTRAL, "2027-09-01", "2027-11-30");
        termina("2027-08-31", PeriodoDoPlano.TRIMESTRAL, "2027-11-30", "2028-02-29");
        // 29/02 bissexto: o ano seguinte cai em 28/02 e volta a 29/02 quatro anos depois.
        termina("2028-02-29", PeriodoDoPlano.ANUAL, "2028-03-01", "2029-02-28");
        termina("2028-02-29", PeriodoDoPlano.ANUAL, "2029-03-01", "2030-02-28");
        termina("2028-02-29", PeriodoDoPlano.ANUAL, "2031-03-01", "2032-02-29");
    }

    @Test
    void terminoNuncaFicaParaTrasDeHojeEmPlanoRecorrente() {
        for (PeriodoDoPlano periodo : new PeriodoDoPlano[] {PeriodoDoPlano.MENSAL, PeriodoDoPlano.TRIMESTRAL,
                PeriodoDoPlano.SEMESTRAL, PeriodoDoPlano.ANUAL}) {
            LocalDate ancora = d("2026-01-31");
            for (LocalDate hoje = ancora; hoje.isBefore(d("2029-01-01")); hoje = hoje.plusDays(1)) {
                LocalDate termino = CalendarioDeCobranca.fimDoCicloAtual(ancora, periodo, hoje);
                assertThat(termino).as("%s hoje %s", periodo, hoje).isAfter(hoje);
                assertThat(termino).isBeforeOrEqualTo(hoje.plusMonths(periodo.meses()).plusDays(3));
            }
        }
    }

    @Test
    void ancoraNoFuturoEOProprioFimDoCiclo() {
        // Retomada dentro de período já pago: a âncora (fim do pago) é o fim do ciclo que corre.
        termina("2027-04-15", PeriodoDoPlano.TRIMESTRAL, "2027-02-01", "2027-04-15");
        termina("2027-04-15", PeriodoDoPlano.TRIMESTRAL, "2027-04-15", "2027-07-15");
    }

    @Test
    void mensalNaoTemAlertaDeRenovacaoENuncaVence() {
        VigenciaDoPlano v = de("2027-01-15", PeriodoDoPlano.MENSAL, "2027-04-20");
        assertThat(v.termino()).isEqualTo(d("2027-05-15"));
        assertThat(v.diasRestantes()).isEqualTo(25);
        assertThat(v.alerta()).isNull();
        assertThat(v.renovacaoProxima()).isFalse();
    }

    @Test
    void maioresQueUmMesAlertamPelosMesmosLimiares() {
        // 42 dias: em dia; 40: próximo; hoje no fim do ciclo vira o seguinte (nunca vencido).
        VigenciaDoPlano folgada = de("2027-01-01", PeriodoDoPlano.TRIMESTRAL, "2027-02-18");
        assertThat(folgada.termino()).isEqualTo(d("2027-04-01"));
        assertThat(folgada.diasRestantes()).isEqualTo(42);
        assertThat(folgada.alerta()).isEqualTo("EM_DIA");
        VigenciaDoPlano limite = de("2027-01-01", PeriodoDoPlano.TRIMESTRAL, "2027-02-20");
        assertThat(limite.diasRestantes()).isEqualTo(40);
        assertThat(limite.alerta()).isEqualTo("PROXIMO_VENCIMENTO");
        assertThat(limite.renovacaoProxima()).isTrue();
        VigenciaDoPlano noFim = de("2027-01-01", PeriodoDoPlano.TRIMESTRAL, "2027-04-01");
        assertThat(noFim.termino()).isEqualTo(d("2027-07-01"));
        assertThat(noFim.alerta()).isEqualTo("EM_DIA");
        assertThat(de("2027-01-01", PeriodoDoPlano.ANUAL, "2027-12-25").alerta()).isEqualTo("PROXIMO_VENCIMENTO");
    }

    @Test
    void parcelaUnicaSoAlertaComOFimDoCicloDentroDaJanela() {
        // O único ciclo é início + 1 mês: dentro dos 40 dias alerta e conta; passado o término não alerta nem conta.
        VigenciaDoPlano dentro = de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-01-20");
        assertThat(dentro.alerta()).isEqualTo("PROXIMO_VENCIMENTO");
        assertThat(dentro.renovacaoProxima()).isTrue();
        assertThat(de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-02-15").alerta()).isEqualTo("PROXIMO_VENCIMENTO");
        VigenciaDoPlano passada = de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-04-20");
        assertThat(passada.termino()).isEqualTo(d("2027-02-15"));
        assertThat(passada.diasRestantes()).isEqualTo(-64);
        assertThat(passada.alerta()).isNull();
        assertThat(passada.renovacaoProxima()).isFalse();
        // Encerrou sem renovar: de 1 a 30 dias depois do término (o dia do término ainda é o último do ciclo).
        assertThat(de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-02-15").encerrouSemRenovar()).isFalse();
        assertThat(de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-02-16").encerrouSemRenovar()).isTrue();
        assertThat(de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-03-17").encerrouSemRenovar()).isTrue();
        assertThat(de("2027-01-15", PeriodoDoPlano.PARCELA_UNICA, "2027-03-18").encerrouSemRenovar()).isFalse();
        assertThat(passada.encerrouSemRenovar()).isFalse();
        // Contratação futura longe do início: o término ainda está além da janela.
        VigenciaDoPlano longe = VigenciaDoPlano.de(d("2027-06-01"), PeriodoDoPlano.PARCELA_UNICA, d("2027-06-01"), d("2027-01-15"));
        assertThat(longe.alerta()).isEqualTo("EM_DIA");
        assertThat(longe.renovacaoProxima()).isFalse();
    }

    @Test
    void parcelaUnicaNaoTemCicloNoCalendario() {
        assertThatThrownBy(() -> CalendarioDeCobranca.fimDoCicloAtual(d("2027-01-15"), PeriodoDoPlano.PARCELA_UNICA, d("2027-01-15")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
