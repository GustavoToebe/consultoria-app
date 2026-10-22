package br.com.treinos.api.execucao;

import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Cardio;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** O tipo da série vira nome pela metodologia da versão: nunca o código cru, a não ser que o código não exista nela. */
class IndiceVersaoTest {

    private static String tipoDe(IndiceVersao indice, UUID serie) {
        return indice.serie(serie).orElseThrow().tipo();
    }

    @Test
    void usaOsNomesDaMetodologiaCopiadaNaVersao() {
        ApiDeTeste.TreinoDeTeste t = ApiDeTeste.treino();
        ConfiguracaoConsultoria padrao = ConfiguracaoConsultoria.padrao();
        List<TipoDeSerie> tipos = padrao.tipos().stream()
                .map(x -> x.codigo().equals("BACK_OFF")
                        ? new TipoDeSerie(x.codigo(), "  Recuo ", x.papel(), x.repeticoes(), x.cargaPadrao(), x.esforcoPadrao(),
                        x.porModalidade(), x.regraPercentuais(), x.explicacao())
                        : x).toList();
        ConfiguracaoConsultoria propria = new ConfiguracaoConsultoria(tipos, padrao.tecnicas(), padrao.combinacoes(),
                padrao.arredondamentoKg(), "", "");
        IndiceVersao indice = new IndiceVersao(UUID.randomUUID(), t.conteudo()
                .comMetodologia(new ConteudoTreino.Metodologia(null, "Própria", propria)));
        assertThat(tipoDe(indice, t.fsUid())).isEqualTo("FS");
        assertThat(tipoDe(indice, t.wsUid())).isEqualTo("WS");
        assertThat(tipoDe(indice, t.backOffUid())).isEqualTo("Recuo");
        assertThat(indice.serie(t.wsUid()).orElseThrow().trabalho()).isTrue();
    }

    @Test
    void semMetodologiaNaVersaoUsaAPadraoECodigoDesconhecidoCaiNoProprioCodigo() {
        UUID desconhecida = UUID.randomUUID();
        UUID semTipo = UUID.randomUUID();
        UUID cardio = UUID.randomUUID();
        UUID ws = UUID.randomUUID();
        ExercicioPlano ex = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null, null, true,
                "kg", List.of(Serie.de(ws, "WORKING", 3, 6, Carga.de("CARGA_TRABALHO")),
                Serie.de(desconhecida, "PIRAMIDE", 3, 6, null), Serie.de(semTipo, null, 3, 6, null)));
        ExercicioPlano esteira = new ExercicioPlano(UUID.randomUUID(), null, "Esteira", "CARDIO", null, null, null,
                "nenhuma", List.of(Serie.de(cardio, null, null, null, null).comCardio(new Cardio(30, null, null, null, null))));
        ConteudoTreino conteudo = new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, List.of(ex, esteira))));
        IndiceVersao indice = new IndiceVersao(UUID.randomUUID(), conteudo);
        assertThat(tipoDe(indice, ws)).isEqualTo("WS");
        assertThat(tipoDe(indice, desconhecida)).isEqualTo("PIRAMIDE");
        assertThat(tipoDe(indice, semTipo)).isNull();
        assertThat(tipoDe(indice, cardio)).isNull();
    }
}
