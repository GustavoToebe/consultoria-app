package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.agenda.AgendaDtos.Repeticao;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A regra da série de compromissos, sem banco nem relógio: dia 31, 29/02, dias úteis, os dois tipos de fim e os limites. */
class RepeticaoDeCompromissoTest {

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    private static Repeticao porVezes(TipoDeRepeticao tipo, int vezes) {
        return new Repeticao(tipo, null, null, vezes);
    }

    private static Repeticao porData(TipoDeRepeticao tipo, String ate) {
        return new Repeticao(tipo, null, d(ate), null);
    }

    private static void recusa(LocalDate primeira, Repeticao r, String codigo) {
        assertThatThrownBy(() -> RepeticaoDeCompromisso.expandir(primeira, r))
                .isInstanceOfSatisfying(BadRequestException.class, e -> assertThat(e.getCodigo()).isEqualTo(codigo));
    }

    @Test
    void diariaPorNContaAPrimeira() {
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-03-01"), porVezes(TipoDeRepeticao.DIARIA, 3)))
                .containsExactly(d("2027-03-01"), d("2027-03-02"), d("2027-03-03"));
    }

    @Test
    void diariaPorDataIncluiAData() {
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-02-27"), porData(TipoDeRepeticao.DIARIA, "2027-03-02")))
                .containsExactly(d("2027-02-27"), d("2027-02-28"), d("2027-03-01"), d("2027-03-02"));
    }

    @Test
    void semanalComDoisDiasSegueAOrdemDoCalendario() {
        // 2027-03-01 é segunda-feira.
        Repeticao r = new Repeticao(TipoDeRepeticao.SEMANAL, Set.of("MONDAY", "THURSDAY"), null, 5);
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-03-01"), r))
                .containsExactly(d("2027-03-01"), d("2027-03-04"), d("2027-03-08"), d("2027-03-11"), d("2027-03-15"));
    }

    @Test
    void semanalDeUmDiaSoRepeteTodaSemana() {
        Repeticao r = new Repeticao(TipoDeRepeticao.SEMANAL, Set.of("MONDAY"), d("2027-03-22"), null);
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-03-01"), r))
                .containsExactly(d("2027-03-01"), d("2027-03-08"), d("2027-03-15"), d("2027-03-22"));
    }

    @Test
    void diasDaSemanaSoAceitamNomeEmTextoNuncaNumero() {
        recusa(d("2027-03-02"), new Repeticao(TipoDeRepeticao.SEMANAL, Set.of("1"), null, 3), "REPETICAO_INVALIDA");
        recusa(d("2027-03-02"), new Repeticao(TipoDeRepeticao.SEMANAL, Set.of("TERCA"), null, 3), "REPETICAO_INVALIDA");
        // 2027-03-02 é terça-feira; o nome vale sem diferença de caixa.
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-03-02"), new Repeticao(TipoDeRepeticao.SEMANAL, Set.of("tuesday"), null, 2)))
                .containsExactly(d("2027-03-02"), d("2027-03-09"));
    }

    @Test
    void semanalExigeDiasQueIncluamADataDoCompromisso() {
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.SEMANAL, Set.of("TUESDAY"), null, 3), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.SEMANAL, Set.of(), null, 3), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.SEMANAL, null, null, 3), "REPETICAO_INVALIDA");
    }

    @Test
    void diasDaSemanaSoValemNaRepeticaoSemanal() {
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.DIARIA, Set.of("MONDAY"), null, 3), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.DIAS_UTEIS, Set.of("MONDAY"), null, 3), "REPETICAO_INVALIDA");
    }

    @Test
    void mensalNoDia31PulaOsMesesSemOutroDia() {
        // Jan 31, (fev pula), mar 31, (abr pula), mai 31, (jun pula), jul 31.
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-01-31"), porVezes(TipoDeRepeticao.MENSAL, 4)))
                .containsExactly(d("2027-01-31"), d("2027-03-31"), d("2027-05-31"), d("2027-07-31"));
    }

    @Test
    void mensalNoDia30PulaSoOFevereiro() {
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-01-30"), porVezes(TipoDeRepeticao.MENSAL, 3)))
                .containsExactly(d("2027-01-30"), d("2027-03-30"), d("2027-04-30"));
    }

    @Test
    void mensalCruzaOAno() {
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-11-15"), porVezes(TipoDeRepeticao.MENSAL, 4)))
                .containsExactly(d("2027-11-15"), d("2027-12-15"), d("2028-01-15"), d("2028-02-15"));
    }

    @Test
    void anualEm29DeFevereiroSoCaiEmAnoBissexto() {
        // 2100 não é bissexto: de 2096 vai para 2104.
        assertThat(RepeticaoDeCompromisso.expandir(d("2092-02-29"), porVezes(TipoDeRepeticao.ANUAL, 4)))
                .containsExactly(d("2092-02-29"), d("2096-02-29"), d("2104-02-29"), d("2108-02-29"));
        assertThat(RepeticaoDeCompromisso.expandir(d("2028-02-29"), porData(TipoDeRepeticao.ANUAL, "2037-01-01")))
                .containsExactly(d("2028-02-29"), d("2032-02-29"), d("2036-02-29"));
    }

    @Test
    void anualComumRepeteNoMesmoDia() {
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-10-05"), porVezes(TipoDeRepeticao.ANUAL, 3)))
                .containsExactly(d("2027-10-05"), d("2028-10-05"), d("2029-10-05"));
    }

    @Test
    void diasUteisPulamOFimDeSemana() {
        // 2027-03-04 é quinta-feira.
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-03-04"), porVezes(TipoDeRepeticao.DIAS_UTEIS, 5)))
                .containsExactly(d("2027-03-04"), d("2027-03-05"), d("2027-03-08"), d("2027-03-09"), d("2027-03-10"));
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-03-05"), porData(TipoDeRepeticao.DIAS_UTEIS, "2027-03-09")))
                .containsExactly(d("2027-03-05"), d("2027-03-08"), d("2027-03-09"));
    }

    @Test
    void diasUteisExigemQueAPrimeiraDataSejaDiaUtil() {
        // 2027-03-06 é sábado.
        recusa(d("2027-03-06"), porVezes(TipoDeRepeticao.DIAS_UTEIS, 3), "REPETICAO_INVALIDA");
    }

    @Test
    void semFimOuComOsDoisFinsOuForaDaFaixaERecusado() {
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.DIARIA, null, null, null), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), new Repeticao(TipoDeRepeticao.DIARIA, null, d("2027-03-10"), 3), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), porVezes(TipoDeRepeticao.DIARIA, 1), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), porVezes(TipoDeRepeticao.DIARIA, 53), "REPETICAO_INVALIDA");
        recusa(d("2027-03-01"), new Repeticao(null, null, null, 3), "REPETICAO_INVALIDA");
    }

    @Test
    void dataFinalAntesOuIgualAoInicioOuComUmaSoOcorrenciaERecusada() {
        recusa(d("2027-03-10"), porData(TipoDeRepeticao.DIARIA, "2027-03-09"), "REPETICAO_INVALIDA");
        recusa(d("2027-03-10"), porData(TipoDeRepeticao.DIARIA, "2027-03-10"), "REPETICAO_INVALIDA");
        // Anual com data final antes do ano seguinte: só a primeira, menos de duas.
        recusa(d("2027-03-10"), porData(TipoDeRepeticao.ANUAL, "2028-03-09"), "REPETICAO_INVALIDA");
    }

    @Test
    void limiteDe52ValeNasDuasFormas() {
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-01-01"), porVezes(TipoDeRepeticao.DIARIA, 52))).hasSize(52);
        // 2027-01-01 + 51 dias = 2027-02-21: exatamente 52 ocorrências.
        assertThat(RepeticaoDeCompromisso.expandir(d("2027-01-01"), porData(TipoDeRepeticao.DIARIA, "2027-02-21"))).hasSize(52);
        // Um dia a mais já passa do limite: recusa, não corta.
        recusa(d("2027-01-01"), porData(TipoDeRepeticao.DIARIA, "2027-02-22"), "SERIE_GRANDE_DEMAIS");
        // Uma série diária por décadas é recusada sem expandir tudo.
        recusa(d("2027-01-01"), porData(TipoDeRepeticao.DIARIA, "2099-12-31"), "SERIE_GRANDE_DEMAIS");
        recusa(d("2027-01-31"), porData(TipoDeRepeticao.MENSAL, "9999-12-31"), "SERIE_GRANDE_DEMAIS");
    }
}
