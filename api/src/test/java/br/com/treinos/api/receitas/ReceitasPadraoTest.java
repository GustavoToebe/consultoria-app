package br.com.treinos.api.receitas;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ValidadorTreino;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** As receitas padrão nascem no contrato novo: códigos de tipo da metodologia padrão, séries válidas, sem Cardio. */
class ReceitasPadraoTest {

    private static List<ReceitasPadrao.Padrao> series() {
        return ReceitasPadrao.todas().stream().filter(p -> p.tipo() == Receita.Tipo.SERIES).toList();
    }

    @Test
    void todasAsReceitasDeSeriesPassamPelasRegrasDaSerie() {
        assertThat(series()).isNotEmpty();
        for (ReceitasPadrao.Padrao p : series()) {
            for (Serie x : ((ReceitaSeries) p.conteudo()).series()) {
                assertThat(ValidadorTreino.problemasDaSerie(x, false)).as(p.nome()).isEmpty();
            }
        }
    }

    @Test
    void tiposDasSeriesSaoCodigosDaMetodologiaPadrao() {
        Set<String> codigos = ConfiguracaoConsultoria.padrao().tipos().stream()
                .map(ConfiguracaoConsultoria.TipoDeSerie::codigo).collect(Collectors.toSet());
        for (ReceitasPadrao.Padrao p : series()) {
            for (Serie x : ((ReceitaSeries) p.conteudo()).series()) {
                assertThat(codigos).as(p.nome()).contains(x.tipo());
            }
        }
    }

    @Test
    void restPauseEATecnicaDaPropriaSerieDeTrabalhoENaoTemReceitaDeCardio() {
        assertThat(series()).extracting(ReceitasPadrao.Padrao::nome).doesNotContain("Cardio");
        ReceitaSeries restPause = (ReceitaSeries) series().stream().filter(p -> p.nome().equals("WS + Rest pause"))
                .findFirst().orElseThrow().conteudo();
        assertThat(restPause.series()).hasSize(1);
        assertThat(restPause.series().get(0).tipo()).isEqualTo("WORKING");
        assertThat(restPause.series().get(0).deTrabalho()).isTrue();
        assertThat(restPause.series().get(0).tecnica().tipo()).isEqualTo("REST_PAUSE");
    }

    @Test
    void asCincoReceitasCompletasVemNoTopoDasReceitasDeSerie() {
        List<String> nomes = List.of("3 FS + WS + Rest pause", "3 FS + WS + 2 Back off", "3 FS + WS + Cluster",
                "3 FS + Cluster", "2 FS + WS + Back off");
        assertThat(series().subList(0, 5)).extracting(ReceitasPadrao.Padrao::nome).containsExactlyElementsOf(nomes);
        assertThat(ReceitasPadrao.todas().get(0).tipo()).isEqualTo(Receita.Tipo.METODOLOGIA);
        assertThat(ReceitasPadrao.todas().subList(1, 6)).extracting(ReceitasPadrao.Padrao::nome)
                .containsExactlyElementsOf(nomes);
        assertThat(ReceitasPadrao.todas()).extracting(ReceitasPadrao.Padrao::tipo).doesNotContain(Receita.Tipo.PLANO_TREINO);

        List<Serie> restPause = serieDe("3 FS + WS + Rest pause");
        assertThat(restPause).extracting(Serie::tipo).containsExactly("FEEDER", "FEEDER", "FEEDER", "WORKING", "WORKING");
        assertThat(restPause).extracting(Serie::repsMin).containsExactly(3, 3, 3, 3, 6);
        assertThat(restPause).extracting(Serie::repsMax).containsExactly(5, 5, 5, 6, 8);
        assertThat(restPause.get(2).carga().percentualMin()).isEqualByComparingTo("85");
        assertThat(restPause.get(2).carga().percentualMax()).isEqualByComparingTo("90");
        assertThat(restPause.get(4).tecnica().tipo()).isEqualTo("REST_PAUSE");
        assertThat(restPause.get(4).tecnica().pausaSegundos()).isEqualTo(20);
        assertThat(restPause.get(4).tecnica().pausas()).isEqualTo(1);

        List<Serie> backOff = serieDe("3 FS + WS + 2 Back off");
        assertThat(backOff).extracting(Serie::tipo)
                .containsExactly("FEEDER", "FEEDER", "FEEDER", "WORKING", "BACK_OFF", "BACK_OFF");
        assertThat(backOff.get(4).carga().modo()).isEqualTo("PERCENTUAL_WS");
        assertThat(backOff.get(4).carga().percentualMin()).isEqualByComparingTo("85");
        assertThat(backOff.get(4).repsMin()).isEqualTo(6);
        assertThat(backOff.get(4).repsMax()).isEqualTo(8);

        assertThat(serieDe("3 FS + WS + Cluster")).extracting(Serie::tipo)
                .containsExactly("FEEDER", "FEEDER", "FEEDER", "WORKING", "WORKING");
        assertThat(serieDe("3 FS + Cluster")).extracting(Serie::tipo)
                .containsExactly("FEEDER", "FEEDER", "FEEDER", "WORKING");
        assertThat(serieDe("2 FS + WS + Back off")).extracting(Serie::tipo)
                .containsExactly("FEEDER", "FEEDER", "WORKING", "BACK_OFF");
        for (String nome : List.of("3 FS + WS + Cluster", "3 FS + Cluster")) {
            Serie cluster = serieDe(nome).getLast();
            assertThat(cluster.repsMin()).isEqualTo(12);
            assertThat(cluster.repsMax()).isEqualTo(12);
            assertThat(cluster.tecnica().tipo()).isEqualTo("CLUSTER");
            assertThat(cluster.tecnica().blocos()).containsExactly(3, 3, 3, 3);
            assertThat(cluster.tecnica().pausaSegundos()).isEqualTo(15);
        }

        // RIR 0 na série de trabalho e no back off; a preparação não leva esforço.
        for (String nome : nomes) {
            for (Serie x : serieDe(nome)) {
                if (x.tipo().equals("FEEDER")) {
                    assertThat(x.esforco()).as(nome).isNull();
                } else {
                    assertThat(x.esforco().rir()).as(nome).isZero();
                }
            }
        }
    }

    private static List<Serie> serieDe(String nome) {
        return ((ReceitaSeries) series().stream().filter(p -> p.nome().equals(nome)).findFirst().orElseThrow()
                .conteudo()).series();
    }

    @Test
    void osDoisExemplosExistemNaListaDepoisDoCatalogoComConteudoEsperado() {
        assertThat(ReceitasPadrao.NOMES_DOS_EXEMPLOS)
                .containsExactly("Exemplo: FS, WS e Cluster", "Exemplo: FS e Cluster");
        assertThat(ReceitasPadrao.exemplos()).extracting(ReceitasPadrao.Padrao::nome)
                .containsExactlyElementsOf(ReceitasPadrao.NOMES_DOS_EXEMPLOS);
        List<String> nomes = ReceitasPadrao.todas().stream().map(ReceitasPadrao.Padrao::nome).toList();
        assertThat(nomes).containsAll(ReceitasPadrao.NOMES_DOS_EXEMPLOS);
        assertThat(nomes.indexOf("Exemplo: FS, WS e Cluster")).isEqualTo(nomes.indexOf("FST-7") + 1);

        List<Serie> completa = ((ReceitaSeries) ReceitasPadrao.exemplos().get(0).conteudo()).series();
        assertThat(completa).extracting(Serie::tipo).containsExactly("FEEDER", "WORKING", "WORKING");
        assertThat(completa).extracting(Serie::repsMin).containsExactly(10, 6, 16);
        assertThat(completa).extracting(Serie::repsMax).containsExactly(15, 8, 16);
        List<Serie> curta = ((ReceitaSeries) ReceitasPadrao.exemplos().get(1).conteudo()).series();
        assertThat(curta).extracting(Serie::tipo).containsExactly("FEEDER", "WORKING");
        assertThat(curta.get(1)).isEqualTo(completa.get(2));

        for (List<Serie> series : List.of(completa, curta)) {
            Serie cluster = series.getLast();
            assertThat(cluster.tecnica().tipo()).isEqualTo("CLUSTER");
            assertThat(cluster.tecnica().blocos()).containsExactly(4, 4, 4, 4);
            assertThat(cluster.tecnica().pausaSegundos()).isEqualTo(15);
            assertThat(cluster.deTrabalho()).isTrue();
            assertThat(series.getFirst().tecnica()).isNull();
            assertThat(series).allSatisfy(s -> {
                assertThat(s.esforco()).isNull();
                assertThat(s.descansoSegundos()).isNull();
            });
        }
    }

    @Test
    void descricoesDosExemplosSaoNeutras() {
        for (ReceitasPadrao.Padrao p : ReceitasPadrao.exemplos()) {
            for (String proibida : List.of("vídeo", "video", "reunião", "reuniao")) {
                assertThat(p.descricao()).as(p.nome()).doesNotContainIgnoringCase(proibida);
            }
        }
    }

    @Test
    void metodologiaPadraoVemNaListaEPassaNaValidacaoDaReceita() {
        ReceitasPadrao.Padrao metodologia = ReceitasPadrao.todas().get(0);
        assertThat(metodologia.tipo()).isEqualTo(Receita.Tipo.METODOLOGIA);
        ConfiguracaoConsultoria.validarComoMetodologia((ConfiguracaoConsultoria) metodologia.conteudo());
    }
}
