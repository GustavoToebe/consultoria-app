package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** As datas das cobranças, sem banco nem relógio: fim de mês, ano bissexto, dia 31 em mês curto e retomada. */
class CalendarioDeCobrancaTest {

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    @Test
    void competenciaContaSempreDaAncoraSemEncadearDatas() {
        LocalDate ancora = d("2027-01-31");
        LocalDate fevereiro = CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, d("2027-01-31"));
        LocalDate marco = CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, fevereiro);
        assertThat(fevereiro).isEqualTo(d("2027-02-28"));
        // Encadeando, 28/02 + 1 mês daria 28/03; a conta correta volta ao dia 31.
        assertThat(marco).isEqualTo(d("2027-03-31"));
    }

    @Test
    void anoBissextoAceitaVinteENoveDeFevereiro() {
        assertThat(CalendarioDeCobranca.proximaCompetencia(d("2028-01-29"), PeriodoDoPlano.MENSAL, d("2028-01-29")))
                .isEqualTo(d("2028-02-29"));
        assertThat(CalendarioDeCobranca.proximaCompetencia(d("2027-01-29"), PeriodoDoPlano.MENSAL, d("2027-01-29")))
                .isEqualTo(d("2027-02-28"));
    }

    @Test
    void periodicidadeAndaEmPassosDeMesesDoPlano() {
        LocalDate ancora = d("2027-01-15");
        assertThat(CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.TRIMESTRAL, ancora)).isEqualTo(d("2027-04-15"));
        assertThat(CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.SEMESTRAL, ancora)).isEqualTo(d("2027-07-15"));
        assertThat(CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.ANUAL, ancora)).isEqualTo(d("2028-01-15"));
    }

    @Test
    void semCobrancaAindaComecaNaAncoraEPulaOQueJaExiste() {
        LocalDate ancora = d("2027-01-10");
        assertThat(CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, null)).isEqualTo(ancora);
        // A maior competência existente é a de abril: a próxima é maio.
        assertThat(CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, d("2027-04-10"))).isEqualTo(d("2027-05-10"));
    }

    @Test
    void parcelaUnicaNaoTemProximaCompetencia() {
        assertThatThrownBy(() -> CalendarioDeCobranca.proximaCompetencia(d("2027-01-10"), PeriodoDoPlano.PARCELA_UNICA, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void vencimentoNoDiaCombinadoDoMesDaCompetenciaQuandoAindaNaoPassou() {
        assertThat(CalendarioDeCobranca.vencimento(d("2027-03-01"), 10, null)).isEqualTo(d("2027-03-10"));
        assertThat(CalendarioDeCobranca.vencimento(d("2027-03-10"), 10, null)).isEqualTo(d("2027-03-10"));
    }

    @Test
    void vencimentoPassaParaOMesSeguinteQuandoODiaJaPassouDaCompetencia() {
        assertThat(CalendarioDeCobranca.vencimento(d("2027-03-20"), 10, null)).isEqualTo(d("2027-04-10"));
    }

    @Test
    void dia31EmMesCurtoVaiParaOUltimoDia() {
        assertThat(CalendarioDeCobranca.vencimento(d("2027-04-01"), 31, null)).isEqualTo(d("2027-04-30"));
        assertThat(CalendarioDeCobranca.vencimento(d("2027-02-01"), 31, null)).isEqualTo(d("2027-02-28"));
        assertThat(CalendarioDeCobranca.vencimento(d("2028-02-01"), 31, null)).isEqualTo(d("2028-02-29"));
        assertThat(CalendarioDeCobranca.vencimento(d("2027-05-01"), 31, null)).isEqualTo(d("2027-05-31"));
    }

    @Test
    void dia31NaCompetenciaDoDia30DeAbrilFicaNoMesmoDia() {
        assertThat(CalendarioDeCobranca.vencimento(d("2027-04-30"), 31, null)).isEqualTo(d("2027-04-30"));
    }

    @Test
    void pisoImpedeVencimentoAnteriorAHoje() {
        // Piso em 20/03 com dia 10: a primeira data possível é 10/04, não 10/03.
        assertThat(CalendarioDeCobranca.vencimento(d("2027-03-01"), 10, d("2027-03-20"))).isEqualTo(d("2027-04-10"));
        // Piso anterior à competência não muda nada.
        assertThat(CalendarioDeCobranca.vencimento(d("2027-03-01"), 10, d("2027-02-01"))).isEqualTo(d("2027-03-10"));
    }

    @Test
    void retomadaSemNenhumaPagaVaiParaHoje() {
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-11-01"), PeriodoDoPlano.TRIMESTRAL, null)).isEqualTo(d("2027-11-01"));
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-11-01"), PeriodoDoPlano.MENSAL, null)).isEqualTo(d("2027-11-01"));
    }

    @Test
    void retomadaNaoSobrepoePeriodoPagoEPisoEODiaSeguinteAoFim() {
        // Trimestral pago de 01/10: o período vai até 31/12, o dia seguinte ao fim é 01/01; retomar em 01/11 fica em 01/01.
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-11-01"), PeriodoDoPlano.TRIMESTRAL, d("2027-10-01")))
                .isEqualTo(d("2028-01-01"));
        // Semestral e anual, com a mesma conta de meses.
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-11-01"), PeriodoDoPlano.SEMESTRAL, d("2027-10-01")))
                .isEqualTo(d("2028-04-01"));
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-11-01"), PeriodoDoPlano.ANUAL, d("2027-03-10")))
                .isEqualTo(d("2028-03-10"));
        // Mensal pago de 15/06 cobre até 14/07: retomar em 10/07 fica em 15/07.
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-07-10"), PeriodoDoPlano.MENSAL, d("2027-06-15")))
                .isEqualTo(d("2027-07-15"));
    }

    @Test
    void retomadaDepoisDoFimDoPeriodoPagoValeHojeEOFimExatoTambem() {
        // Mensal pago de 15/06: o dia seguinte ao fim é 15/07; retomar em 20/07 vale hoje, em 15/07 também (igual).
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-07-20"), PeriodoDoPlano.MENSAL, d("2027-06-15")))
                .isEqualTo(d("2027-07-20"));
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-07-15"), PeriodoDoPlano.MENSAL, d("2027-06-15")))
                .isEqualTo(d("2027-07-15"));
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2028-04-02"), PeriodoDoPlano.TRIMESTRAL, d("2027-10-01")))
                .isEqualTo(d("2028-04-02"));
    }

    @Test
    void retomadaComPagoEmFimDeMesUsaAMesmaContaDeMesesDasCompetencias() {
        // Pago de 31/01 mensal: 31/01 + 1 mês = 28/02 (o último dia do mês, como nas competências); em 2028, 29/02.
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-02-10"), PeriodoDoPlano.MENSAL, d("2027-01-31")))
                .isEqualTo(d("2027-02-28"));
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2028-02-10"), PeriodoDoPlano.MENSAL, d("2028-01-31")))
                .isEqualTo(d("2028-02-29"));
        // Já passou do fim: vale hoje.
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-03-05"), PeriodoDoPlano.MENSAL, d("2027-01-31")))
                .isEqualTo(d("2027-03-05"));
        // Anual pago em 29/02/2028: o dia seguinte ao fim é 28/02/2029.
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2028-06-01"), PeriodoDoPlano.ANUAL, d("2028-02-29")))
                .isEqualTo(d("2029-02-28"));
    }

    @Test
    void parcelaUnicaNaoTemPisoPeloPeriodoPago() {
        assertThat(CalendarioDeCobranca.ancoraDaRetomada(d("2027-11-01"), PeriodoDoPlano.PARCELA_UNICA, d("2027-10-01")))
                .isEqualTo(d("2027-11-01"));
    }

    @Test
    void retomadaRecolocaAAncoraNoDiaDaRetomada() {
        // Depois de uma pausa a âncora é o dia da retomada: as competências seguem dele, não do início antigo.
        LocalDate ancora = d("2027-06-17");
        LocalDate competencia = CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, d("2027-02-10"));
        assertThat(competencia).isEqualTo(ancora);
        assertThat(CalendarioDeCobranca.vencimento(competencia, 5, null)).isEqualTo(d("2027-07-05"));
    }
}
