package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.RegraDosLembretes.Configuracao;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Qual lembrete de cobrança é devido hoje, sem banco nem relógio: janelas, folga, fim de mês, configuração 0 e desligada. */
class RegraDosLembretesTest {

    private static final Configuracao PADRAO_LIGADO = new Configuracao(true, 3, true, 3);

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    private static Optional<TipoDeLembrete> devido(String hoje, String vencimento, Configuracao c) {
        return RegraDosLembretes.devido(d(hoje), d(vencimento), c);
    }

    @Test
    void desligadaOuNulaNuncaEDevida() {
        assertThat(devido("2027-03-07", "2027-03-10", RegraDosLembretes.Configuracao.PADRAO)).isEmpty();
        assertThat(devido("2027-03-10", "2027-03-10", new Configuracao(false, 3, true, 3))).isEmpty();
        assertThat(RegraDosLembretes.devido(d("2027-03-10"), d("2027-03-10"), null)).isEmpty();
    }

    @Test
    void antesNoDiaEDepoisNosDiasCertos() {
        assertThat(devido("2027-03-07", "2027-03-10", PADRAO_LIGADO)).contains(TipoDeLembrete.ANTES);
        assertThat(devido("2027-03-10", "2027-03-10", PADRAO_LIGADO)).contains(TipoDeLembrete.NO_DIA);
        assertThat(devido("2027-03-13", "2027-03-10", PADRAO_LIGADO)).contains(TipoDeLembrete.DEPOIS);
        // Fora das janelas: nada.
        assertThat(devido("2027-03-06", "2027-03-10", PADRAO_LIGADO)).isEmpty();
        assertThat(devido("2027-03-11", "2027-03-10", PADRAO_LIGADO)).isEmpty();
        assertThat(devido("2027-03-12", "2027-03-10", PADRAO_LIGADO)).isEmpty();
    }

    @Test
    void folgaDeDoisDiasParaOJobQueNaoRodou() {
        assertThat(devido("2027-03-08", "2027-03-10", PADRAO_LIGADO)).contains(TipoDeLembrete.ANTES);
        assertThat(devido("2027-03-09", "2027-03-10", PADRAO_LIGADO)).contains(TipoDeLembrete.ANTES);
        assertThat(devido("2027-03-15", "2027-03-10", PADRAO_LIGADO)).contains(TipoDeLembrete.DEPOIS);
        assertThat(devido("2027-03-16", "2027-03-10", PADRAO_LIGADO)).isEmpty();
    }

    @Test
    void antesNuncaSaiNoDiaDoVencimentoMesmoComFolga() {
        Configuracao umDia = new Configuracao(true, 1, false, 0);
        assertThat(devido("2027-03-09", "2027-03-10", umDia)).contains(TipoDeLembrete.ANTES);
        assertThat(devido("2027-03-10", "2027-03-10", umDia)).isEmpty();
    }

    @Test
    void zeroDiasDesligaAqueleLembrete() {
        Configuracao soNoDia = new Configuracao(true, 0, true, 0);
        assertThat(devido("2027-03-07", "2027-03-10", soNoDia)).isEmpty();
        assertThat(devido("2027-03-10", "2027-03-10", soNoDia)).contains(TipoDeLembrete.NO_DIA);
        assertThat(devido("2027-03-13", "2027-03-10", soNoDia)).isEmpty();
        Configuracao semNoDia = new Configuracao(true, 3, false, 3);
        assertThat(devido("2027-03-10", "2027-03-10", semNoDia)).isEmpty();
    }

    @Test
    void viraOMesEOAno() {
        assertThat(devido("2027-02-26", "2027-03-01", PADRAO_LIGADO)).contains(TipoDeLembrete.ANTES);
        assertThat(devido("2027-01-03", "2026-12-31", PADRAO_LIGADO)).contains(TipoDeLembrete.DEPOIS);
        // Ano bissexto: 29/02 é o vencimento.
        assertThat(devido("2028-02-26", "2028-02-29", PADRAO_LIGADO)).contains(TipoDeLembrete.ANTES);
        assertThat(devido("2028-03-03", "2028-02-29", PADRAO_LIGADO)).contains(TipoDeLembrete.DEPOIS);
    }

    @Test
    void vencimentoNoPassadoDistanteNaoGeraLembrete() {
        Configuracao maximo = new Configuracao(true, 15, true, 30);
        assertThat(devido("2027-03-10", "2026-01-10", maximo)).isEmpty();
        assertThat(devido("2027-03-10", "2027-02-01", maximo)).isEmpty();
        // No limite: 30 dias depois e mais 2 de folga.
        assertThat(devido("2027-03-10", "2027-02-08", maximo)).contains(TipoDeLembrete.DEPOIS);
        assertThat(devido("2027-03-10", "2027-02-06", maximo)).contains(TipoDeLembrete.DEPOIS);
        assertThat(devido("2027-03-10", "2027-02-05", maximo)).isEmpty();
    }

    @Test
    void oIntervaloDeBuscaCobreTodasAsJanelas() {
        LocalDate hoje = d("2027-03-10");
        Configuracao maximo = new Configuracao(true, 15, true, 30);
        assertThat(RegraDosLembretes.devido(hoje, RegraDosLembretes.maiorVencimento(hoje), maximo)).contains(TipoDeLembrete.ANTES);
        assertThat(RegraDosLembretes.devido(hoje, RegraDosLembretes.menorVencimento(hoje), maximo)).contains(TipoDeLembrete.DEPOIS);
        assertThat(RegraDosLembretes.devido(hoje, RegraDosLembretes.maiorVencimento(hoje).plusDays(1), maximo)).isEmpty();
        assertThat(RegraDosLembretes.devido(hoje, RegraDosLembretes.menorVencimento(hoje).minusDays(1), maximo)).isEmpty();
    }

    @Test
    void situacaoDeHojeParaOWhatsApp() {
        assertThat(RegraDosLembretes.situacaoDeHoje(d("2027-03-09"), d("2027-03-10"))).isEqualTo(TipoDeLembrete.ANTES);
        assertThat(RegraDosLembretes.situacaoDeHoje(d("2027-03-10"), d("2027-03-10"))).isEqualTo(TipoDeLembrete.NO_DIA);
        assertThat(RegraDosLembretes.situacaoDeHoje(d("2027-03-11"), d("2027-03-10"))).isEqualTo(TipoDeLembrete.DEPOIS);
    }
}
