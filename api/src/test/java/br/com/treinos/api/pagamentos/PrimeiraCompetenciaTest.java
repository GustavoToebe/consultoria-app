package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** D10 sem banco nem relógio: a primeira competência ao contratar e as que nascem junto, em datas fixas. */
class PrimeiraCompetenciaTest {

    private static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    @Test
    void comMesesAnterioresOuInicioNoMesCorrenteOuNoFuturoFicaNoInicio() {
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-03-15"), PeriodoDoPlano.MENSAL, d("2026-11-18"), true))
                .isEqualTo(d("2026-03-15"));
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-11-02"), PeriodoDoPlano.MENSAL, d("2026-11-18"), false))
                .isEqualTo(d("2026-11-02"));
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2027-01-10"), PeriodoDoPlano.MENSAL, d("2026-11-18"), false))
                .isEqualTo(d("2027-01-10"));
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-03-15"), PeriodoDoPlano.PARCELA_UNICA, d("2026-11-18"), false))
                .isEqualTo(d("2026-03-15"));
    }

    @Test
    void semMesesAnterioresMensalCaiNoMesCorrenteEDia31SeguraNaGrade() {
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-03-15"), PeriodoDoPlano.MENSAL, d("2026-11-18"), false))
                .isEqualTo(d("2026-11-15"));
        // 31/01 em novembro vira 30/11 e em dezembro volta a 31/12: a grade é a do início, nunca encadeada.
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-01-31"), PeriodoDoPlano.MENSAL, d("2026-11-18"), false))
                .isEqualTo(d("2026-11-30"));
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-01-31"), PeriodoDoPlano.MENSAL, d("2026-12-01"), false))
                .isEqualTo(d("2026-12-31"));
    }

    @Test
    void semMesesAnterioresPlanoLongoComecaNoPeriodoQueCobreOMesCorrente() {
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-03-15"), PeriodoDoPlano.TRIMESTRAL, d("2026-11-18"), false))
                .isEqualTo(d("2026-09-15"));
        assertThat(CalendarioDeCobranca.primeiraCompetencia(d("2026-03-15"), PeriodoDoPlano.ANUAL, d("2027-02-01"), false))
                .isEqualTo(d("2026-03-15"));
    }

    @Test
    void competenciasSeguemAteOPrimeiroVencimentoDeHojeEmDiante() {
        // Desligado: só o mês corrente (vence 20/11, depois de hoje).
        assertThat(CalendarioDeCobranca.competenciasAoContratar(d("2026-01-31"), PeriodoDoPlano.MENSAL, 20, d("2026-11-18"), false))
                .containsExactly(d("2026-11-30"));
        // Ligado: do início até a competência cujo vencimento ainda não passou (a de 10/11 vence em 5/12).
        assertThat(CalendarioDeCobranca.competenciasAoContratar(d("2026-09-10"), PeriodoDoPlano.MENSAL, 5, d("2026-11-18"), true))
                .containsExactly(d("2026-09-10"), d("2026-10-10"), d("2026-11-10"));
        // Vencida na hora: a competência do mês corrente venceu em 5/11 e a seguinte já nasce.
        assertThat(CalendarioDeCobranca.competenciasAoContratar(d("2026-09-02"), PeriodoDoPlano.MENSAL, 5, d("2026-11-18"), false))
                .containsExactly(d("2026-11-02"), d("2026-12-02"));
        // Parcela única nunca gera a seguinte.
        assertThat(CalendarioDeCobranca.competenciasAoContratar(d("2026-03-15"), PeriodoDoPlano.PARCELA_UNICA, 5, d("2026-11-18"), true))
                .isEqualTo(List.of(d("2026-03-15")));
    }
}
