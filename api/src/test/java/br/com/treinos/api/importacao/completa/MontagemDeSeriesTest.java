package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.importacao.completa.MontagemDeSeries.Entrada;
import br.com.treinos.api.importacao.completa.MontagemDeSeries.Logico;
import br.com.treinos.api.importacao.completa.MontagemDeSeries.Numero;
import br.com.treinos.api.importacao.completa.MontagemDeSeries.Resultado;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.celula;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Paridade com os casos do {@code planos.test.mjs} que montam séries ({@code montarSeries}) e com as linhas de exercício
 * da planilha fictícia do mesmo teste. Sem banco: metodologia de série do sistema ({@link ConfiguracaoConsultoria#padrao()}).
 */
class MontagemDeSeriesTest {

    private static final ConfiguracaoConsultoria PADRAO = ConfiguracaoConsultoria.padrao();
    private static final LeitorDePrescricao.Faixa TRES_A_SEIS = LeitorDePrescricao.faixaDeRepeticoes(celula("3a6"), false);

    private static Numero n(Object v) {
        return MontagemDeSeries.numero(celula(v));
    }

    private static Entrada entrada(Object ws, Object fs, Logico ts, Logico bo, Object backoff, LeitorDePrescricao.Faixa f) {
        return new Entrada(n(ws), n(fs), ts, bo, n(backoff), f);
    }

    private static List<Integer> percentuaisMinimos(List<Serie> series) {
        return series.stream().map(s -> s.carga().percentualMin() == null ? null : s.carga().percentualMin().intValue()).toList();
    }

    @Test
    void fsWsEBackOffComPercentual() {
        Resultado r = MontagemDeSeries.montar(entrada(1, 1, Logico.AUSENTE, Logico.SIM, 0.9, TRES_A_SEIS), PADRAO);
        assertThat(percentuaisMinimos(r.series())).isEqualTo(Arrays.asList(85, null, 90));
        assertThat(r.avisos()).isEmpty();
    }

    @Test
    void ordemFsWsTopSetBackOffSemReferencia() {
        Resultado r = MontagemDeSeries.montar(entrada(1, 1, Logico.SIM, Logico.SIM, 0.9, TRES_A_SEIS), PADRAO);
        assertThat(r.series()).extracting(Serie::tipo).containsExactly("FEEDER", "WORKING", "TOP_SET", "BACK_OFF");
        assertThat(r.series()).extracting(s -> s.carga().modo())
                .containsExactly("PERCENTUAL_WS", "CARGA_TRABALHO", "ACIMA_DA_ANTERIOR", "PERCENTUAL_WS");
        assertThat(r.series()).extracting(s -> s.carga().referenciaUid()).containsOnlyNulls();
        // Top set sem número: nunca inventado, a série fica sem percentual e o aviso conta.
        assertThat(r.series().get(2).carga().percentualMin()).isNull();
        assertThat(r.avisos()).containsExactly("TOP_SET_SEM_PERCENTUAL");
    }

    @Test
    void backOffSemPercentualFicaSemCarga() {
        Resultado r = MontagemDeSeries.montar(entrada(1, null, Logico.AUSENTE, Logico.SIM, 0, TRES_A_SEIS), PADRAO);
        assertThat(r.series()).hasSize(2);
        assertThat(r.series().get(1).carga().modo()).isEqualTo("NENHUMA");
        assertThat(r.avisos()).containsExactly("BACK_OFF_SEM_PERCENTUAL");
    }

    @Test
    void quantidadeNegativaOuQuebradaNaoViraSerie() {
        Resultado r = MontagemDeSeries.montar(entrada(-1, 1.5, Logico.AUSENTE, Logico.AUSENTE, null, TRES_A_SEIS), PADRAO);
        assertThat(r.series()).isEmpty();
        assertThat(r.avisos()).containsExactlyInAnyOrder("QUANTIDADE_DE_WS_INVALIDA", "QUANTIDADE_DE_FS_INVALIDA");
    }

    @Test
    void remadaDaPlanilha() {
        // e1: WS 1, FS 3, BO verdadeiro, Rep Range "3a6", Back Off 0,85.
        Resultado r = MontagemDeSeries.montar(new Entrada(n(1), n(3), MontagemDeSeries.logico(celula(false)),
                MontagemDeSeries.logico(celula(true)), n(0.85), TRES_A_SEIS), PADRAO);
        assertThat(r.series()).extracting(Serie::tipo).containsExactly("FEEDER", "FEEDER", "FEEDER", "WORKING", "BACK_OFF");
        assertThat(percentuaisMinimos(r.series())).isEqualTo(Arrays.asList(50, 70, 85, null, 85));
        assertThat(r.series().get(2).carga().percentualMax()).isEqualByComparingTo(new BigDecimal("90"));
        Serie ws = r.series().get(3);
        assertThat(ws.repsMin()).isEqualTo(3);
        assertThat(ws.repsMax()).isEqualTo(6);
        Serie bo = r.series().get(4);
        assertThat(bo.repsMin()).isEqualTo(6);
        assertThat(bo.repsMax()).isEqualTo(8);
        assertThat(r.avisos()).isEmpty();
    }

    @Test
    void puxadaSemPreparacaoNemBackOff() {
        Resultado r = MontagemDeSeries.montar(new Entrada(n(3), n(0), Logico.NAO, Logico.NAO, n(0.8),
                LeitorDePrescricao.faixaDeRepeticoes(celula("6a8"), false)), PADRAO);
        assertThat(r.series()).extracting(Serie::tipo).containsExactly("WORKING", "WORKING", "WORKING");
        assertThat(r.series()).extracting(Serie::repsMin).containsOnly(6);
        assertThat(r.series()).extracting(Serie::repsMax).containsOnly(8);
    }

    @Test
    void faixaQueOExcelVirouDataERecuperada() {
        // e3: Rep Range 46364 (a data 08/12/2026) = 8 a 12.
        Resultado r = MontagemDeSeries.montar(entrada(1, 2, Logico.NAO, Logico.SIM, 0.9,
                LeitorDePrescricao.faixaDeRepeticoes(celula(46364), false)), PADRAO);
        assertThat(r.faixaRecuperada()).isTrue();
        assertThat(percentuaisMinimos(r.series())).isEqualTo(Arrays.asList(70, 85, null, 90));
        assertThat(r.series().get(2).repsMin()).isEqualTo(8);
        assertThat(r.series().get(2).repsMax()).isEqualTo(12);
        assertThat(r.avisos()).doesNotContain("FAIXA_VIROU_DATA");
    }

    @Test
    void quantidadeAcimaDeDezEFsSemRegra() {
        // e4: WS 23 (ignorada) e FS 4 (a regra de série só vai até 3: séries sem percentual inventado).
        Resultado r = MontagemDeSeries.montar(entrada(23, 4, Logico.NAO, Logico.NAO, 0.8,
                LeitorDePrescricao.faixaDeRepeticoes(celula(8), false)), PADRAO);
        assertThat(r.series()).extracting(Serie::tipo).containsExactly("FEEDER", "FEEDER", "FEEDER", "FEEDER");
        assertThat(r.series()).extracting(s -> s.carga().modo()).containsOnly("NENHUMA");
        assertThat(r.avisos()).containsExactlyInAnyOrder("FS_SEM_REGRA_DE_PERCENTUAL", "QUANTIDADE_DE_WS_ACIMA_DE_10");
    }

    @Test
    void faixaInvalidaDeixaAWsSemRepeticoes() {
        // e5: Rep Range "qualquer coisa": a WS nasce, as repetições ficam vazias e o aviso conta.
        Resultado r = MontagemDeSeries.montar(entrada(2, 1, Logico.SIM, Logico.NAO, 0,
                LeitorDePrescricao.faixaDeRepeticoes(celula("qualquer coisa"), false)), PADRAO);
        assertThat(r.series()).extracting(Serie::tipo).containsExactly("FEEDER", "WORKING", "WORKING", "TOP_SET");
        assertThat(r.series().get(1).repsMin()).isNull();
        assertThat(r.avisos()).containsExactly("FAIXA_INVALIDA", "TOP_SET_SEM_PERCENTUAL");
    }

    @Test
    void numeroELogicoComoNoScript() {
        assertThat(MontagemDeSeries.numero(celula("2,5")).valor()).isEqualByComparingTo("2.5");
        assertThat(MontagemDeSeries.numero(celula("abc")).invalido()).isTrue();
        assertThat(MontagemDeSeries.numero(celula(null)).presente()).isFalse();
        assertThat(MontagemDeSeries.logico(celula("Sim"))).isEqualTo(Logico.SIM);
        assertThat(MontagemDeSeries.logico(celula("não"))).isEqualTo(Logico.NAO);
        assertThat(MontagemDeSeries.logico(celula(1))).isEqualTo(Logico.SIM);
        assertThat(MontagemDeSeries.logico(celula(0))).isEqualTo(Logico.NAO);
        assertThat(MontagemDeSeries.logico(celula("talvez"))).isEqualTo(Logico.INVALIDO);
        assertThat(MontagemDeSeries.logico(celula(null))).isEqualTo(Logico.AUSENTE);
    }
}
