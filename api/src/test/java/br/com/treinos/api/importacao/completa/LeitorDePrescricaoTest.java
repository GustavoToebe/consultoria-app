package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.ErroDaFaixa;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.Faixa;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.Prescricao;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.Tecnica;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.TecnicaEscrita;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.numero;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.serie;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.texto;
import static org.assertj.core.api.Assertions.assertThat;

/** Leitura da prescrição. Os casos de faixa são os mesmos do {@code planos.test.mjs}, com o mesmo resultado. */
class LeitorDePrescricaoTest {

    private static Faixa faixa(Celula c) {
        return LeitorDePrescricao.faixaDeRepeticoes(c, false);
    }

    private static Celula serial(String iso) {
        return numero(String.valueOf(serie(iso)));
    }

    private static void ok(Faixa f, int min, int max, boolean deData) {
        assertThat(f.erro()).isNull();
        assertThat(f.min()).isEqualTo(min);
        assertThat(f.max()).isEqualTo(max);
        assertThat(f.deData()).isEqualTo(deData);
    }

    private static void erro(Faixa f, ErroDaFaixa erro) {
        assertThat(f.erro()).isEqualTo(erro);
    }

    @Test
    void paridadeRegrasPequenasDaFaixa() {
        // planos.test.mjs: "regras pequenas: faixa de repetições..."
        ok(faixa(texto("6a8")), 6, 8, false);
        ok(faixa(texto("3 - 6")), 3, 6, false);
        ok(faixa(numero("8")), 8, 8, false);
        ok(faixa(serial("2026-12-08")), 8, 12, true);
        erro(faixa(serial("1999-05-06")), ErroDaFaixa.DATA);
        erro(faixa(texto("8a6")), ErroDaFaixa.INVALIDA);
        erro(faixa(texto("abc")), ErroDaFaixa.INVALIDA);
        erro(faixa(null), ErroDaFaixa.VAZIA);
    }

    @Test
    void paridadeFaixaQueVirouDataPeloNumeroDoExcel() {
        // planos.test.mjs: "faixa que virou data: dia e mês do menor para o maior..."
        ok(faixa(serial("2026-08-06")), 6, 8, true);
        ok(faixa(serial("2026-06-08")), 6, 8, true);
        ok(faixa(serial("2026-10-12")), 10, 12, true);
        ok(faixa(serial("2026-12-10")), 10, 12, true);
        ok(faixa(numero(serie("2026-12-10") + ".75")), 10, 12, true);
        ok(faixa(serial("2026-06-20")), 6, 20, true);
        ok(faixa(serial("2015-01-02")), 1, 2, true);
        ok(faixa(serial("2040-12-31")), 12, 31, true);
        erro(faixa(serial("2014-12-31")), ErroDaFaixa.DATA);
        erro(faixa(serial("2041-01-01")), ErroDaFaixa.DATA);
        erro(faixa(serial("1999-05-06")), ErroDaFaixa.DATA);
        erro(faixa(numero("600")), ErroDaFaixa.DATA);
        erro(faixa(numero("-3")), ErroDaFaixa.INVALIDA);
        ok(faixa(numero("8")), 8, 8, false);
    }

    @Test
    void paridadeFaixaQueVirouDataEmTextoE1904() {
        // planos.test.mjs: "faixa que virou data: texto de data, dia ou mês acima de 50, ano impossível e 1904"
        String[][] recuperadas = {
            {"6/8", "6", "8"}, {"8/6", "6", "8"}, {"12/10", "10", "12"}, {"06/08/2026", "6", "8"}, {"10/12/26", "10", "12"},
            {"2026-08-06", "6", "8"}, {"2026-08-06T00:00:00", "6", "8"}, {"2026-08-06 00:00:00", "6", "8"},
            {"06-08-2026", "6", "8"}, {" 6 / 8 ", "6", "8"}, {"8/50", "8", "50"},
        };
        for (String[] c : recuperadas) {
            ok(faixa(texto(c[0])), Integer.parseInt(c[1]), Integer.parseInt(c[2]), true);
        }
        for (String impossivel : new String[] {"6/60", "51/8", "0/8", "6/8/1999", "6/8/2099", "2026-13-60"}) {
            erro(faixa(texto(impossivel)), ErroDaFaixa.DATA);
        }
        ok(faixa(texto("6-8")), 6, 8, false);
        erro(faixa(texto("12-10")), ErroDaFaixa.INVALIDA);
        ok(faixa(texto("6a8")), 6, 8, false);
        long em1904 = serie("2026-08-06") - 1462;
        ok(LeitorDePrescricao.faixaDeRepeticoes(numero(String.valueOf(em1904)), true), 6, 8, true);
        Faixa sem1904 = LeitorDePrescricao.faixaDeRepeticoes(numero(String.valueOf(em1904)), false);
        assertThat(sem1904.ok() && sem1904.min() == 6 && sem1904.max() == 8).isFalse();
    }

    @Test
    void seriesERepeticoes() {
        assertThat(LeitorDePrescricao.ler("4x10")).isEqualTo(p(4, 10, 10, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3x8-12")).isEqualTo(p(3, 8, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3 X 8 a 12")).isEqualTo(p(3, 8, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("4 × 6 até 8 reps")).isEqualTo(p(4, 6, 8, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3 séries de 10")).isEqualTo(p(3, 10, 10, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3 Séries de 8 a 12 repetições"))
                .isEqualTo(p(3, 8, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("10-12")).isEqualTo(p(null, 10, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("12 repetições")).isEqualTo(p(null, 12, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3x falha")).isEqualTo(p(3, null, null, false, true, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("até a falha")).isEqualTo(p(null, null, null, false, true, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("Falha")).isEqualTo(p(null, null, null, false, true, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("AMRAP")).isEqualTo(p(null, null, null, true, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("2x amrap")).isEqualTo(p(2, null, null, true, false, null, Set.of(), ""));
    }

    @Test
    void cargaETecnicas() {
        assertThat(LeitorDePrescricao.ler("30 kg")).isEqualTo(p(null, null, null, false, false, new BigDecimal("30"), Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("30kg")).isEqualTo(p(null, null, null, false, false, new BigDecimal("30"), Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("4x10 22,5kg")).isEqualTo(p(4, 10, 10, false, false, new BigDecimal("22.5"), Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("4x10 rest pause"))
                .isEqualTo(p(4, 10, 10, false, false, null, Set.of(Tecnica.REST_PAUSE), "", TecnicaEscrita.so(Tecnica.REST_PAUSE)));
        assertThat(LeitorDePrescricao.ler("3x12 + drop-set"))
                .isEqualTo(p(3, 12, 12, false, false, null, Set.of(Tecnica.DROP_SET), "", TecnicaEscrita.so(Tecnica.DROP_SET)));
        assertThat(LeitorDePrescricao.ler("drop")).isEqualTo(p(null, null, null, false, false, null, Set.of(Tecnica.DROP_SET), "",
                TecnicaEscrita.so(Tecnica.DROP_SET)));
        assertThat(LeitorDePrescricao.ler("Cluster 4x6"))
                .isEqualTo(p(4, 6, 6, false, false, null, Set.of(Tecnica.CLUSTER), "", TecnicaEscrita.so(Tecnica.CLUSTER)));
        // Duas técnicas na mesma célula: as palavras são vistas, mas nenhuma é lida com detalhes.
        assertThat(LeitorDePrescricao.ler("rest pause e drop").tecnica()).isNull();
        assertThat(LeitorDePrescricao.ler("rest pause e drop").tecnicas()).contains(Tecnica.REST_PAUSE, Tecnica.DROP_SET);
        assertThat(LeitorDePrescricao.ler("bi-set com o próximo").tecnicas()).containsExactly(Tecnica.SUPERSET);
        assertThat(LeitorDePrescricao.ler("Superset").tecnicas()).containsExactly(Tecnica.SUPERSET);
        assertThat(LeitorDePrescricao.ler("rest-pause").tecnicas()).containsExactly(Tecnica.REST_PAUSE);
    }

    @Test
    void oQueNaoEntendeVaiParaASobraENadaEInventado() {
        Prescricao nada = LeitorDePrescricao.ler("conforme combinado");
        assertThat(nada.naoEntendida()).isTrue();
        assertThat(nada.series()).isNull();
        assertThat(nada.repsMin()).isNull();
        assertThat(nada.cargaKg()).isNull();
        assertThat(nada.sobra()).isEqualTo("conforme combinado");

        Prescricao parte = LeitorDePrescricao.ler("4x10, segurar 2s embaixo");
        assertThat(parte.series()).isEqualTo(4);
        assertThat(parte.comSobra()).isTrue();
        assertThat(parte.sobra()).isEqualTo("segurar 2s embaixo");

        // Cadência não é faixa de repetições; série e repetição fora dos limites não são lidas.
        Prescricao cadencia = LeitorDePrescricao.ler("cadência 3-0-1");
        assertThat(cadencia.repsMin()).isNull();
        assertThat(cadencia.naoEntendida()).isTrue();
        assertThat(LeitorDePrescricao.ler("99x10").series()).isNull();
        assertThat(LeitorDePrescricao.ler("4x999").repsMin()).isNull();
        assertThat(LeitorDePrescricao.ler("12-8").repsMin()).isNull();
        assertThat(LeitorDePrescricao.ler("0 kg").cargaKg()).isNull();

        assertThat(LeitorDePrescricao.ler("   ").vazia()).isTrue();
        assertThat(LeitorDePrescricao.ler((String) null).vazia()).isTrue();
    }

    @Test
    void celulaNumericaEDataRecuperada() {
        Prescricao numero = LeitorDePrescricao.ler(numero("8"), false);
        assertThat(numero.repsMin()).isEqualTo(8);
        assertThat(numero.repsMax()).isEqualTo(8);
        Prescricao data = LeitorDePrescricao.ler(serial("2026-12-08"), false);
        assertThat(data.repsMin()).isEqualTo(8);
        assertThat(data.repsMax()).isEqualTo(12);
        assertThat(data.faixaDeData()).isTrue();
        assertThat(LeitorDePrescricao.ler(texto("6/8"), false).faixaDeData()).isTrue();
        assertThat(LeitorDePrescricao.ler(serial("1999-05-06"), false).naoEntendida()).isTrue();
        assertThat(LeitorDePrescricao.ler(new Celula("", false, true), false).vazia()).isTrue();
    }

    // ------------------------------------------------------------------------------------- fase 2 (01/11)

    @Test
    void piramideUmaSeriePorNumero() {
        Prescricao p = LeitorDePrescricao.ler("10-8-6");
        assertThat(p.series()).isEqualTo(3);
        assertThat(p.piramide()).containsExactly(10, 8, 6);
        assertThat(p.repsMin()).isNull();
        assertThat(p.sobra()).isEmpty();
        assertThat(LeitorDePrescricao.ler("12/10/8/6 reps").piramide()).containsExactly(12, 10, 8, 6);
        assertThat(LeitorDePrescricao.ler("6, 8, 10").piramide()).containsExactly(6, 8, 10);
        Prescricao comSeries = LeitorDePrescricao.ler("4x12-10-8-6");
        assertThat(comSeries.series()).isEqualTo(4);
        assertThat(comSeries.piramide()).containsExactly(12, 10, 8, 6);
        // Séries que não batem com os números: nada é lido e o texto fica todo na sobra.
        Prescricao naoBate = LeitorDePrescricao.ler("4x12/10/8");
        assertThat(naoBate.series()).isNull();
        assertThat(naoBate.piramide()).isNull();
        assertThat(naoBate.naoEntendida()).isTrue();
        // Cadência e números iguais não são pirâmide; dois números são faixa.
        assertThat(LeitorDePrescricao.ler("cadência 4-1-2-1").piramide()).isNull();
        assertThat(LeitorDePrescricao.ler("cadência 4-1-2-1").naoEntendida()).isTrue();
        assertThat(LeitorDePrescricao.ler("10-10-10").piramide()).isNull();
        assertThat(LeitorDePrescricao.ler("8-12").piramide()).isNull();
        assertThat(LeitorDePrescricao.ler("8-12").repsMin()).isEqualTo(8);
    }

    @Test
    void faixaEAteAFalhaComAsSeries() {
        assertThat(LeitorDePrescricao.ler("3x10")).isEqualTo(p(3, 10, 10, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("4x8-12")).isEqualTo(p(4, 8, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3x8 a 12")).isEqualTo(p(3, 8, 12, false, false, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3x até a falha")).isEqualTo(p(3, null, null, false, true, null, Set.of(), ""));
        assertThat(LeitorDePrescricao.ler("3 x ate falha")).isEqualTo(p(3, null, null, false, true, null, Set.of(), ""));
    }

    @Test
    void seriePorTempo() {
        Prescricao s = LeitorDePrescricao.ler("3x30s");
        assertThat(s.series()).isEqualTo(3);
        assertThat(s.duracaoSegundos()).isEqualTo(30);
        assertThat(s.repsMin()).isNull();
        assertThat(s.sobra()).isEmpty();
        assertThat(LeitorDePrescricao.ler("3x1min").duracaoSegundos()).isEqualTo(60);
        assertThat(LeitorDePrescricao.ler("4 x 45 seg").duracaoSegundos()).isEqualTo(45);
        assertThat(LeitorDePrescricao.ler("3x40\"").duracaoSegundos()).isEqualTo(40);
        assertThat(LeitorDePrescricao.ler("2x1'30''").duracaoSegundos()).isEqualTo(90);
        assertThat(LeitorDePrescricao.ler("3x1,5 min").duracaoSegundos()).isEqualTo(90);
        // Faixa de tempo não é lida.
        Prescricao faixa = LeitorDePrescricao.ler("3x30-45s");
        assertThat(faixa.duracaoSegundos()).isNull();
        assertThat(faixa.repsMin()).isNull();
    }

    @Test
    void descansoEscrito() {
        Prescricao p = LeitorDePrescricao.ler("3x10 desc 60s");
        assertThat(p.series()).isEqualTo(3);
        assertThat(p.repsMin()).isEqualTo(10);
        assertThat(p.descansoSegundos()).isEqualTo(60);
        assertThat(p.sobra()).isEmpty();
        assertThat(LeitorDePrescricao.ler("4x8 90\"").descansoSegundos()).isEqualTo(90);
        assertThat(LeitorDePrescricao.ler("3x12 descanso: 1min30").descansoSegundos()).isEqualTo(90);
        assertThat(LeitorDePrescricao.ler("3x12 intervalo de 2 min").descansoSegundos()).isEqualTo(120);
        // "60s" solto não é descanso (pode ser tempo de outra coisa) e faixa de descanso não é lida.
        Prescricao solto = LeitorDePrescricao.ler("3x12 60s");
        assertThat(solto.descansoSegundos()).isNull();
        assertThat(solto.sobra()).isEqualTo("60s");
        Prescricao faixa = LeitorDePrescricao.ler("3x10 desc 60-90s");
        assertThat(faixa.descansoSegundos()).isNull();
        assertThat(faixa.comSobra()).isTrue();
        assertThat(LeitorDePrescricao.ler("3x10 60-90\"").descansoSegundos()).isNull();
        // A coluna "Descanso": só tempo com unidade.
        assertThat(LeitorDePrescricao.descanso("60s")).isEqualTo(60);
        assertThat(LeitorDePrescricao.descanso("1 min")).isEqualTo(60);
        assertThat(LeitorDePrescricao.descanso("90\"")).isEqualTo(90);
        assertThat(LeitorDePrescricao.descanso("Desc: 2min")).isEqualTo(120);
        assertThat(LeitorDePrescricao.descanso("60")).isNull();
        assertThat(LeitorDePrescricao.descanso("60 a 90s")).isNull();
        assertThat(LeitorDePrescricao.descanso("livre")).isNull();
    }

    @Test
    void rirERpeDeUmValorSo() {
        assertThat(LeitorDePrescricao.ler("3x10 RIR 2").rir()).isEqualTo(2);
        assertThat(LeitorDePrescricao.ler("3x10 RIR 2").sobra()).isEmpty();
        assertThat(LeitorDePrescricao.ler("3x10 2 RIR").rir()).isEqualTo(2);
        assertThat(LeitorDePrescricao.ler("3x10 rpe 8,5").rpe()).isEqualByComparingTo("8.5");
        assertThat(LeitorDePrescricao.ler("3x10 RPE 8").rpe()).isEqualByComparingTo("8");
        // Faixa, fora dos limites ou os dois juntos: nada é lido e o texto fica na sobra (e não vira repetição).
        Prescricao faixa = LeitorDePrescricao.ler("3x10 RIR 1-2");
        assertThat(faixa.rir()).isNull();
        assertThat(faixa.repsMin()).isEqualTo(10);
        assertThat(faixa.sobra()).isEqualTo("RIR 1-2");
        assertThat(LeitorDePrescricao.ler("3x10 RIR 7").rir()).isNull();
        assertThat(LeitorDePrescricao.ler("3x10 RPE 8,3").rpe()).isNull();
        Prescricao dois = LeitorDePrescricao.ler("3x10 RIR 2 RPE 8");
        assertThat(dois.rir()).isNull();
        assertThat(dois.rpe()).isNull();
        assertThat(dois.sobra()).contains("RIR 2").contains("RPE 8");
    }

    @Test
    void detalhesDaTecnica() {
        Prescricao rp = LeitorDePrescricao.ler("3x10 rest pause 15s");
        assertThat(rp.tecnica()).isEqualTo(new TecnicaEscrita(Tecnica.REST_PAUSE, 15, null, null, null, null, null, false));
        assertThat(rp.descansoSegundos()).isNull();
        assertThat(LeitorDePrescricao.ler("rest pause (3 micro-séries) 5 respirações").tecnica())
                .isEqualTo(new TecnicaEscrita(Tecnica.REST_PAUSE, null, 5, 2, null, null, null, false));
        assertThat(LeitorDePrescricao.ler("4x10 rest-pause na última série").tecnica().soNaUltima()).isTrue();

        Prescricao cluster = LeitorDePrescricao.ler("3x cluster 4+4+2 pausa 20s");
        assertThat(cluster.tecnica().blocos()).containsExactly(4, 4, 2);
        assertThat(cluster.series()).isEqualTo(3);
        assertThat(cluster.tecnica().pausaSegundos()).isEqualTo(20);
        assertThat(cluster.sobra()).isEqualTo("pausa"); // a palavra solta fica na sobra
        Prescricao longe = LeitorDePrescricao.ler("cluster 4+4+2, fazer com calma e concentração 20s");
        assertThat(longe.tecnica().pausaSegundos()).isNull(); // longe da palavra não é a pausa
        Prescricao cluster2 = LeitorDePrescricao.ler("cluster 20s 3x(4+4+2)");
        assertThat(cluster2.series()).isEqualTo(3);
        assertThat(cluster2.tecnica().blocos()).containsExactly(4, 4, 2);
        assertThat(cluster2.tecnica().pausaSegundos()).isEqualTo(20);
        assertThat(LeitorDePrescricao.ler("cluster 3 blocos de 4").tecnica().blocos()).containsExactly(4, 4, 4);

        Prescricao drop = LeitorDePrescricao.ler("3x12 drop-set 2 quedas 20%");
        assertThat(drop.tecnica()).isEqualTo(new TecnicaEscrita(Tecnica.DROP_SET, null, null, null, null, 2, 20, false));
        assertThat(drop.sobra()).isEmpty();
        assertThat(LeitorDePrescricao.ler("3x10 + 2 drops").tecnica().quedas()).isEqualTo(2);
        assertThat(LeitorDePrescricao.ler("3x10 + 2 drops").tecnicas()).containsExactly(Tecnica.DROP_SET);
        // Superset não é técnica da série.
        assertThat(LeitorDePrescricao.ler("3x10 bi-set").tecnica()).isNull();
        assertThat(List.of()).isEmpty();
    }

    private static Prescricao p(Integer series, Integer min, Integer max, boolean amrap, boolean falha, BigDecimal carga,
                                Set<Tecnica> tecnicas, String sobra) {
        return new Prescricao(series, min, max, amrap, falha, carga, tecnicas, false, sobra);
    }

    private static Prescricao p(Integer series, Integer min, Integer max, boolean amrap, boolean falha, BigDecimal carga,
                                Set<Tecnica> tecnicas, String sobra, TecnicaEscrita tecnica) {
        return new Prescricao(series, min, max, amrap, falha, carga, tecnicas, false, sobra, null, null, null, null, null,
                tecnica);
    }
}
