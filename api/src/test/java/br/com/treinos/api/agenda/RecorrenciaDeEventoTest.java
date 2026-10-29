package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.agenda.RecorrenciaDeEvento.Regra;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A regra de repetição do evento sem aluno, sem banco nem relógio: dia 31, 29/02, dias úteis, semanal com o primeiro dia
 * fora da regra, os dois tipos de fim, "nunca termina" com pulo à janela, a máscara dos dias e as validações. Referência de
 * calendário: 01/01/2030 é uma terça-feira.
 */
class RecorrenciaDeEventoTest {

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    private static List<LocalDate> dias(String... isos) {
        return java.util.Arrays.stream(isos).map(LocalDate::parse).toList();
    }

    private static Regra regra(TipoDeRecorrencia tipo) {
        return new Regra(tipo, Set.of(), null, null);
    }

    private static Regra porVezes(TipoDeRecorrencia tipo, int vezes) {
        return new Regra(tipo, Set.of(), null, vezes);
    }

    private static Regra porData(TipoDeRecorrencia tipo, String ate) {
        return new Regra(tipo, Set.of(), d(ate), null);
    }

    private static Regra semanal(Integer vezes, DayOfWeek... dias) {
        return new Regra(TipoDeRecorrencia.SEMANAL, Set.of(dias), null, vezes);
    }

    private static void recusa(LocalDate inicio, Regra r) {
        assertThatThrownBy(() -> RecorrenciaDeEvento.validar(inicio, r))
                .isInstanceOfSatisfying(BadRequestException.class, e -> assertThat(e.getCodigo()).isEqualTo("REPETICAO_INVALIDA"));
    }

    // ---- expansão ----

    @Test
    void referenciaDoCalendario() {
        assertThat(d("2030-01-01").getDayOfWeek()).isEqualTo(DayOfWeek.TUESDAY);
    }

    @Test
    void semRepeticaoSoCaiNoProprioDia() {
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-10"), Regra.NENHUMA, d("2030-01-01"), d("2030-01-31")))
                .containsExactly(d("2030-01-10"));
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-10"), Regra.NENHUMA, d("2030-01-11"), d("2030-01-31"))).isEmpty();
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-10"), Regra.NENHUMA, d("2030-01-10"), d("2030-01-10")))
                .containsExactly(d("2030-01-10"));
    }

    @Test
    void janelaInvertidaNaoTrazNada() {
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-01"), regra(TipoDeRecorrencia.DIARIA), d("2030-01-10"), d("2030-01-09")))
                .isEmpty();
    }

    @Test
    void diariaPorVezesContaDesdeAPrimeira() {
        Regra tres = porVezes(TipoDeRecorrencia.DIARIA, 3);
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-01"), tres, d("2030-01-01"), d("2030-12-31")))
                .containsExactlyElementsOf(dias("2030-01-01", "2030-01-02", "2030-01-03"));
        // a janela começa no meio: a contagem não recomeça
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-01"), tres, d("2030-01-03"), d("2030-12-31")))
                .containsExactly(d("2030-01-03"));
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-01"), tres, d("2030-01-04"), d("2030-12-31"))).isEmpty();
    }

    @Test
    void diariaPorDataIncluiOUltimoDia() {
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-01"), porData(TipoDeRecorrencia.DIARIA, "2030-01-03"),
                d("2030-01-01"), d("2030-12-31"))).containsExactlyElementsOf(dias("2030-01-01", "2030-01-02", "2030-01-03"));
    }

    @Test
    void mensalNoDia31PulaOsMesesCurtos() {
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-31"), regra(TipoDeRecorrencia.MENSAL), d("2030-01-01"), d("2030-06-30")))
                .containsExactlyElementsOf(dias("2030-01-31", "2030-03-31", "2030-05-31"));
    }

    @Test
    void mensalNoDia30PulaSoFevereiro() {
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-30"), regra(TipoDeRecorrencia.MENSAL), d("2030-01-01"), d("2030-04-30")))
                .containsExactlyElementsOf(dias("2030-01-30", "2030-03-30", "2030-04-30"));
    }

    @Test
    void anualEm29DeFevereiroSoCaiEmAnoBissexto() {
        assertThat(RecorrenciaDeEvento.expandir(d("2028-02-29"), regra(TipoDeRecorrencia.ANUAL), d("2028-01-01"), d("2040-12-31")))
                .containsExactlyElementsOf(dias("2028-02-29", "2032-02-29", "2036-02-29", "2040-02-29"));
    }

    @Test
    void diasUteisPulamOFimDeSemanaESaemDoSabado() {
        Regra uteis = regra(TipoDeRecorrencia.DIAS_UTEIS);
        // 05/01/2030 é sábado: a série começa na segunda, 07/01
        assertThat(RecorrenciaDeEvento.primeira(d("2030-01-05"), uteis)).isEqualTo(d("2030-01-07"));
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-05"), uteis, d("2030-01-05"), d("2030-01-14")))
                .containsExactlyElementsOf(dias("2030-01-07", "2030-01-08", "2030-01-09", "2030-01-10", "2030-01-11", "2030-01-14"));
    }

    @Test
    void semanalComecaNoPrimeiroDiaQueCasaComARegra() {
        Regra segundaEQuarta = semanal(null, DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY);
        // 01/01/2030 é terça: a primeira ocorrência é a quarta, 02/01
        assertThat(RecorrenciaDeEvento.primeira(d("2030-01-01"), segundaEQuarta)).isEqualTo(d("2030-01-02"));
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-01"), segundaEQuarta, d("2030-01-01"), d("2030-01-14")))
                .containsExactlyElementsOf(dias("2030-01-02", "2030-01-07", "2030-01-09", "2030-01-14"));
    }

    @Test
    void semanalPorVezesContaAsOcorrenciasDaRegra() {
        Regra tres = semanal(3, DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY);
        assertThat(RecorrenciaDeEvento.expandir(d("2030-01-07"), tres, d("2030-01-01"), d("2030-12-31")))
                .containsExactlyElementsOf(dias("2030-01-07", "2030-01-09", "2030-01-14"));
    }

    @Test
    void nuncaTerminaPulaDiretoParaAJanelaDistante() {
        assertThat(RecorrenciaDeEvento.expandir(d("2000-01-01"), regra(TipoDeRecorrencia.DIARIA), d("2099-12-01"), d("2099-12-03")))
                .containsExactlyElementsOf(dias("2099-12-01", "2099-12-02", "2099-12-03"));
        assertThat(RecorrenciaDeEvento.expandir(d("2000-01-03"), semanal(null, DayOfWeek.MONDAY), d("2090-06-01"), d("2090-06-30")))
                .allSatisfy(dia -> assertThat(dia.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY))
                .isNotEmpty();
        assertThat(RecorrenciaDeEvento.expandir(d("2000-01-31"), regra(TipoDeRecorrencia.MENSAL), d("2090-01-01"), d("2090-12-31")))
                .allSatisfy(dia -> assertThat(dia.getDayOfMonth()).isEqualTo(31))
                .hasSize(7);
    }

    @Test
    void naoPassaDe2100() {
        List<LocalDate> dias = RecorrenciaDeEvento.expandir(d("2000-01-01"), regra(TipoDeRecorrencia.DIARIA),
                d("2100-12-25"), d("2101-01-31"));
        assertThat(dias).hasSize(7).last().isEqualTo(RecorrenciaDeEvento.ULTIMO_DIA);
    }

    // ---- ocorre e contarAntes ----

    @Test
    void ocorreDizSeODiaEDaRegra() {
        Regra segundas = semanal(null, DayOfWeek.MONDAY);
        assertThat(RecorrenciaDeEvento.ocorre(d("2030-01-07"), segundas, d("2030-01-14"))).isTrue();
        assertThat(RecorrenciaDeEvento.ocorre(d("2030-01-07"), segundas, d("2030-01-15"))).isFalse();
        assertThat(RecorrenciaDeEvento.ocorre(d("2030-01-07"), segundas, d("2030-01-01"))).isFalse();
    }

    @Test
    void contarAntesCortaNaOcorrenciaEComecaPeloFim() {
        Regra cinco = porVezes(TipoDeRecorrencia.DIARIA, 5);
        assertThat(RecorrenciaDeEvento.contarAntes(d("2030-01-01"), cinco, d("2030-01-01"))).isZero();
        assertThat(RecorrenciaDeEvento.contarAntes(d("2030-01-01"), cinco, d("2030-01-04"))).isEqualTo(3);
        assertThat(RecorrenciaDeEvento.contarAntes(d("2030-01-01"), cinco, d("2030-03-01"))).isEqualTo(5);
    }

    // ---- máscara ----

    @Test
    void mascaraDeDiasVaiEVolta() {
        assertThat(RecorrenciaDeEvento.mascara(Set.of(DayOfWeek.MONDAY, DayOfWeek.SUNDAY))).isEqualTo(1 | 64);
        assertThat(RecorrenciaDeEvento.mascara(Set.of())).isZero();
        assertThat(RecorrenciaDeEvento.dias(65)).containsExactlyInAnyOrder(DayOfWeek.MONDAY, DayOfWeek.SUNDAY);
        Set<DayOfWeek> todos = Set.of(DayOfWeek.values());
        assertThat(RecorrenciaDeEvento.mascara(todos)).isEqualTo(127);
        assertThat(RecorrenciaDeEvento.dias(127)).containsExactlyInAnyOrderElementsOf(todos);
    }

    // ---- validação ----

    @Test
    void aceitaRegrasValidas() {
        LocalDate inicio = d("2030-01-01");
        RecorrenciaDeEvento.validar(inicio, Regra.NENHUMA);
        RecorrenciaDeEvento.validar(inicio, regra(TipoDeRecorrencia.DIARIA));
        RecorrenciaDeEvento.validar(inicio, porVezes(TipoDeRecorrencia.MENSAL, 2));
        RecorrenciaDeEvento.validar(inicio, porVezes(TipoDeRecorrencia.MENSAL, RecorrenciaDeEvento.VEZES_MAXIMO));
        RecorrenciaDeEvento.validar(inicio, porData(TipoDeRecorrencia.ANUAL, "2030-01-01"));
        RecorrenciaDeEvento.validar(inicio, semanal(null, DayOfWeek.FRIDAY));
    }

    @Test
    void recusaVezesForaDoLimite() {
        recusa(d("2030-01-01"), porVezes(TipoDeRecorrencia.DIARIA, 1));
        recusa(d("2030-01-01"), porVezes(TipoDeRecorrencia.DIARIA, 0));
        recusa(d("2030-01-01"), porVezes(TipoDeRecorrencia.DIARIA, RecorrenciaDeEvento.VEZES_MAXIMO + 1));
    }

    @Test
    void recusaDataFinalEVezesJuntas() {
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.DIARIA, Set.of(), d("2030-02-01"), 5));
    }

    @Test
    void recusaSemanalSemDiasEDiasForaDaSemanal() {
        recusa(d("2030-01-01"), regra(TipoDeRecorrencia.SEMANAL));
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.DIARIA, Set.of(DayOfWeek.MONDAY), null, null));
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.DIAS_UTEIS, Set.of(DayOfWeek.MONDAY), null, null));
    }

    @Test
    void recusaRegraNaoRepetidaComDetalhes() {
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.NENHUMA, Set.of(), null, 3));
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.NENHUMA, Set.of(), d("2030-02-01"), null));
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.NENHUMA, Set.of(DayOfWeek.MONDAY), null, null));
    }

    @Test
    void recusaDataFinalAntesDaPrimeiraOcorrencia() {
        recusa(d("2030-01-10"), porData(TipoDeRecorrencia.DIARIA, "2030-01-09"));
        // terça: a primeira ocorrência da regra de quartas é 02/01, depois da data final
        recusa(d("2030-01-01"), new Regra(TipoDeRecorrencia.SEMANAL, Set.of(DayOfWeek.WEDNESDAY), d("2030-01-01"), null));
    }

    @Test
    void recusaDatasForaDoIntervaloEValoresNulos() {
        recusa(d("1999-12-31"), Regra.NENHUMA);
        recusa(d("2101-01-01"), Regra.NENHUMA);
        recusa(d("2030-01-01"), porData(TipoDeRecorrencia.DIARIA, "2101-01-01"));
        recusa(null, Regra.NENHUMA);
        recusa(d("2030-01-01"), null);
        recusa(d("2030-01-01"), new Regra(null, Set.of(), null, null));
    }
}
