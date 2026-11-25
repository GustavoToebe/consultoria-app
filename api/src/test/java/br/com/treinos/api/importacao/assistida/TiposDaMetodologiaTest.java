package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Sem Spring, sem banco: só a troca do tipo da série pelo código da metodologia. */
class TiposDaMetodologiaTest {

    private static final ConfiguracaoConsultoria PADRAO = ConfiguracaoConsultoria.padrao();

    private static ConteudoTreino treino(String... tipos) {
        List<Serie> series = new ArrayList<>();
        for (String t : tipos) {
            series.add(Serie.de(UUID.randomUUID(), t, 3, 5, ConteudoTreino.Carga.de(ConteudoTreino.NENHUMA)));
        }
        ExercicioPlano ex = new ExercicioPlano(UUID.randomUUID(), null, "Supino", "MUSCULACAO", null, "obs", true, "kg",
                series);
        return new ConteudoTreino("obj", "orient",
                List.of(new Sessao(UUID.randomUUID(), "A", 1, ConteudoTreino.TREINO, null, null, null, List.of(ex))));
    }

    private static List<String> tipos(ConteudoTreino t) {
        return t.sessoes().getFirst().exercicios().getFirst().series().stream().map(Serie::tipo).toList();
    }

    @Test
    void siglasComunsViramOCodigoDoTipoPeloPapel() {
        ConteudoTreino r = TiposDaMetodologia.normalizar(
                treino("WS", "FS", "AQ", "BO", "TS", "Warm-up", "Back off", "TRABALHO", "preparatoria"), PADRAO);
        assertThat(tipos(r)).containsExactly("WORKING", "FEEDER", "WARM_UP", "BACK_OFF", "TOP_SET", "WARM_UP", "BACK_OFF",
                "WORKING", "FEEDER");
    }

    @Test
    void codigoIgualSemDiferencaDeCaixaENomeComAcentoSemAcento() {
        ConfiguracaoConsultoria config = new ConfiguracaoConsultoria(List.of(
                new TipoDeSerie("AQUEC", "Aquecimento geral", Papel.AQUECIMENTO, null, null, null, null, null),
                new TipoDeSerie("PRINCIPAL", "Série Principal", Papel.TRABALHO, null, null, null, null, null)),
                null, null, null, null, null);
        ConteudoTreino r = TiposDaMetodologia.normalizar(treino("aquec", "serie principal", "Série-Principal"), config);
        assertThat(tipos(r)).containsExactly("AQUEC", "PRINCIPAL", "PRINCIPAL");
    }

    @Test
    void siglaSemTipoDoPapelOuDesconhecidaFicaComoVeio() {
        ConfiguracaoConsultoria semBackOff = new ConfiguracaoConsultoria(List.of(
                new TipoDeSerie("WORKING", "WS", Papel.TRABALHO, null, null, null, null, null)), null, null, null, null, null);
        ConteudoTreino r = TiposDaMetodologia.normalizar(treino("BO", "TS", "Rest pause", "xyz"), semBackOff);
        assertThat(tipos(r)).containsExactly("BO", "TS", "Rest pause", "xyz");
    }

    @Test
    void cardioETipoNuloFicamComoEstao() {
        ExercicioPlano cardio = new ExercicioPlano(UUID.randomUUID(), null, "Esteira", ConteudoTreino.CARDIO, null, null,
                false, "nenhuma", List.of(Serie.de(UUID.randomUUID(), "WS", null, null, null)));
        ExercicioPlano semTipo = new ExercicioPlano(UUID.randomUUID(), null, "Remada", "MUSCULACAO", null, null, true, "kg",
                List.of(Serie.de(UUID.randomUUID(), null, 8, 10, null)));
        ConteudoTreino t = new ConteudoTreino(null, null, List.of(new Sessao(UUID.randomUUID(), "A", 1,
                ConteudoTreino.TREINO, null, null, null, List.of(cardio, semTipo))));
        ConteudoTreino r = TiposDaMetodologia.normalizar(t, PADRAO);
        assertThat(r.sessoes().getFirst().exercicios().get(0).series().getFirst().tipo()).isEqualTo("WS");
        assertThat(r.sessoes().getFirst().exercicios().get(1).series().getFirst().tipo()).isNull();
    }

    @Test
    void naoMexeNosOutrosCampos() {
        ConteudoTreino original = treino("WS");
        ConteudoTreino r = TiposDaMetodologia.normalizar(original, PADRAO);
        Serie antes = original.sessoes().getFirst().exercicios().getFirst().series().getFirst();
        Serie depois = r.sessoes().getFirst().exercicios().getFirst().series().getFirst();
        assertThat(depois).isEqualTo(antes.comTipo("WORKING"));
        assertThat(r.objetivo()).isEqualTo("obj");
        assertThat(r.sessoes().getFirst().exercicios().getFirst().nome()).isEqualTo("Supino");
    }
}
