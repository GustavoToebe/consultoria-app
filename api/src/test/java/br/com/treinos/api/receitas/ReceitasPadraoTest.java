package br.com.treinos.api.receitas;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ValidadorTreino;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** As receitas padrão nascem no contrato novo: códigos de tipo da metodologia padrão, séries válidas, sem Cardio. */
class ReceitasPadraoTest {

    private final JsonMapper json = JsonMapper.builder().build();

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
    void receitaDoTopSetTemBackOffApontandoOTopSetEUidsFixos() {
        ReceitasPadrao.Padrao topSet = series().stream().filter(p -> p.nome().equals("WS + Top set + 2 Back off"))
                .findFirst().orElseThrow();
        List<Serie> lista = ((ReceitaSeries) topSet.conteudo()).series();
        assertThat(lista).extracting(Serie::tipo).containsExactly("WORKING", "TOP_SET", "BACK_OFF", "BACK_OFF");
        assertThat(lista.get(1).carga().modo()).isEqualTo("ACIMA_DA_ANTERIOR");
        assertThat(lista.get(2).carga().modo()).isEqualTo("ABAIXO_DA_REFERENCIA");
        assertThat(lista.get(2).carga().referenciaUid()).isEqualTo(lista.get(1).uid());
        assertThat(lista.get(3).carga().referenciaUid()).isEqualTo(lista.get(1).uid());
        // Uids fixos: o JSON da receita (e da migration) é sempre o mesmo.
        ReceitasPadrao.Padrao outra = ReceitasPadrao.todas().stream().filter(p -> p.nome().equals(topSet.nome()))
                .findFirst().orElseThrow();
        assertThat(json.writeValueAsString(outra.conteudo())).isEqualTo(json.writeValueAsString(topSet.conteudo()));
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
