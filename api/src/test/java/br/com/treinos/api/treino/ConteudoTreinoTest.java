package br.com.treinos.api.treino;

import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Grupo;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** {@code comUidsNovos}: todo uid é novo, e o {@code grupoUid} dos exercícios acompanha o uid novo do grupo. */
class ConteudoTreinoTest {

    private static final UUID ANTIGO_GRUPO = UUID.randomUUID();

    private static ConteudoTreino conteudo() {
        Serie ws = Serie.de(UUID.randomUUID(), "WORKING", 3, 6, Carga.de("CARGA_TRABALHO"));
        Serie backOff1 = Serie.de(UUID.randomUUID(), "BACK_OFF", 6, 8, Carga.percentual("PERCENTUAL_WS", 85, null));
        Serie backOff2 = Serie.de(UUID.randomUUID(), "BACK_OFF", 6, 8, Carga.percentual("PERCENTUAL_WS", 85, null));
        ExercicioPlano supino = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null, null,
                true, "kg", List.of(ws, backOff1, backOff2), null, null, ANTIGO_GRUPO);
        ExercicioPlano crucifixo = new ExercicioPlano(UUID.randomUUID(), null, "Crucifixo", "LIVRE", null, null, true,
                "kg", List.of(Serie.de(UUID.randomUUID(), "WORKING", 8, 12, Carga.de("CARGA_TRABALHO"))), null, null,
                ANTIGO_GRUPO);
        ExercicioPlano solto = new ExercicioPlano(UUID.randomUUID(), null, "Rosca direta", "LIVRE", null, null, true,
                "kg", List.of(Serie.de(UUID.randomUUID(), "WORKING", 8, 12, Carga.de("CARGA_TRABALHO"))));
        return new ConteudoTreino(null, null, List.of(new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null,
                null, List.of(supino, crucifixo, solto), List.of(new Grupo(ANTIGO_GRUPO, "SUPERSET", 60, null)))));
    }

    private static Set<UUID> uids(ConteudoTreino c) {
        List<UUID> todos = new ArrayList<>();
        for (Sessao s : c.sessoes()) {
            todos.add(s.uid());
            s.gruposOuVazio().forEach(g -> todos.add(g.uid()));
            for (ExercicioPlano e : s.exerciciosOuVazio()) {
                todos.add(e.uid());
                e.seriesOuVazio().forEach(x -> todos.add(x.uid()));
            }
        }
        assertThat(todos).doesNotHaveDuplicates();
        return new HashSet<>(todos);
    }

    @Test
    void todoUidFicaNovoInclusiveOsDoGrupo() {
        ConteudoTreino antes = conteudo();
        ConteudoTreino depois = antes.comUidsNovos();
        assertThat(uids(depois)).hasSameSizeAs(uids(antes)).doesNotContainAnyElementsOf(uids(antes));
        assertThat(depois.sessoes().get(0).grupos()).hasSize(1);
    }

    @Test
    void cargaDasSeriesNaoMudaNaCopia() {
        List<Serie> series = conteudo().comUidsNovos().sessoes().get(0).exercicios().get(0).series();
        assertThat(series.get(1).carga().modo()).isEqualTo("PERCENTUAL_WS");
        assertThat(series.get(1).carga().percentualMin()).isEqualByComparingTo("85");
        assertThat(series.get(0).carga().modo()).isEqualTo("CARGA_TRABALHO");
    }

    @Test
    void grupoUidDosExerciciosAcompanhaOUidNovoDoGrupo() {
        ConteudoTreino depois = conteudo().comUidsNovos();
        Sessao sessao = depois.sessoes().get(0);
        UUID novoGrupo = sessao.grupos().get(0).uid();
        assertThat(novoGrupo).isNotEqualTo(ANTIGO_GRUPO);
        assertThat(sessao.grupos().get(0).tecnica()).isEqualTo("SUPERSET");
        assertThat(sessao.grupos().get(0).descansoAposSegundos()).isEqualTo(60);
        assertThat(sessao.exercicios().get(0).grupoUid()).isEqualTo(novoGrupo);
        assertThat(sessao.exercicios().get(1).grupoUid()).isEqualTo(novoGrupo);
        assertThat(sessao.exercicios().get(2).grupoUid()).isNull();
    }

    @Test
    void conteudoCopiadoContinuaValidoNoValidador() {
        ValidadorTreino validador = new ValidadorTreino(new br.com.treinos.api.web.VideoUrls(List.of("youtube.com")));
        ConteudoTreino original = conteudo();
        assertThat(validador.validar(original, null, null).erros()).isEmpty();
        assertThat(validador.validar(original.comUidsNovos(), null, null).erros()).isEmpty();
    }

    @Test
    void sessaoSemGruposTemListaVaziaNuncaNula() {
        // O pacote offline e o editor do app leem `grupos` como lista: nulo no JSON fazia o app descartar o pacote.
        Sessao semGrupos = new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, List.of());
        assertThat(semGrupos.grupos()).isEmpty();
        ConteudoTreino depois = new ConteudoTreino(null, null, List.of(semGrupos)).comUidsNovos();
        assertThat(depois.sessoes().get(0).grupos()).isNotNull().isEmpty();
    }
}
