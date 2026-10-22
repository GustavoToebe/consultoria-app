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
    void metodologiaPadraoVemNaListaEPassaNaValidacaoDaReceita() {
        ReceitasPadrao.Padrao metodologia = ReceitasPadrao.todas().get(0);
        assertThat(metodologia.tipo()).isEqualTo(Receita.Tipo.METODOLOGIA);
        ConfiguracaoConsultoria.validarComoMetodologia((ConfiguracaoConsultoria) metodologia.conteudo());
    }
}
