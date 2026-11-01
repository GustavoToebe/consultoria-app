package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Indice;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Nivel;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Resultado;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Casamento de nomes. Os casos de nota e sugestão são os do {@code planos.test.mjs} (correspondências). */
class CasamentoDeNomesTest {

    /** A biblioteca fictícia do {@code paresFicticios()} do teste em Node. */
    private static final List<String> BIBLIOTECA = List.of("Supino reto com barra", "Remada curvada", "Puxada alta na polia",
            "Rosca direta");

    @Test
    void paridadeDaNotaDeSemelhanca() {
        assertThat(CasamentoDeNomes.notaDeSemelhanca("rosca direta", "rosca direta")).isEqualTo(1.0);
        assertThat(CasamentoDeNomes.notaDeSemelhanca("abc", "xyz")).isZero();
        assertThat(CasamentoDeNomes.notaDeSemelhanca("rosca direta", "direta rosca")).isGreaterThan(0.5);
        assertThat(CasamentoDeNomes.notaDeSemelhanca("", "x")).isZero();
    }

    @Test
    void paridadeDasSugestoes() {
        Indice indice = new Indice(BIBLIOTECA);
        // Par exato, mesmo com acento, caixa e espaços: certo (no script, nota 1).
        assertThat(indice.casar("SUPÍNO RETO COM BARRA  ")).isEqualTo(new Resultado(Nivel.CERTO, "Supino reto com barra", 1));
        assertThat(indice.casar("RÓSCA DIRÉTA")).isEqualTo(new Resultado(Nivel.CERTO, "Rosca direta", 1));
        Resultado curvada = indice.casar("Remada Curvadda");
        assertThat(curvada.nivel()).isEqualTo(Nivel.PROVAVEL);
        assertThat(curvada.candidato()).isEqualTo("Remada curvada");
        assertThat(curvada.nota()).isBetween(0.5, 1.0);
        assertThat(indice.casar("Puxada altta polia").candidato()).isEqualTo("Puxada alta na polia");
        assertThat(indice.casar("Xyzzy qwerty")).isEqualTo(new Resultado(Nivel.NENHUM, null, 0));
        assertThat(indice.casar("qqqq").nivel()).isEqualTo(Nivel.NENHUM);
        assertThat(new Indice(List.of()).casar("qqqq").nivel()).isEqualTo(Nivel.NENHUM);
    }

    @Test
    void abreviacoesOrdemEPlural() {
        Indice indice = new Indice(List.of("Supino inclinado com halteres", "Remada unilateral na máquina",
                "Elevação lateral com halteres", "Abdominais na polia"));
        assertThat(indice.casar("Supino incl. c/ hal.")).extracting(Resultado::nivel, Resultado::candidato)
                .containsExactly(Nivel.CERTO, "Supino inclinado com halteres");
        assertThat(indice.casar("Remada unilat. máq.").candidato()).isEqualTo("Remada unilateral na máquina");
        assertThat(indice.casar("Remada unilat. máq.").nivel()).isEqualTo(Nivel.CERTO);
        assertThat(indice.casar("Elevação lateral com halter").nivel()).isEqualTo(Nivel.CERTO);
        assertThat(indice.casar("Lateral elevação halteres").nivel()).isEqualTo(Nivel.CERTO);
        assertThat(indice.casar("Abdominal polia").nivel()).isEqualTo(Nivel.CERTO);
        assertThat(indice.casar("Supino inclinado halter barra").nivel()).isEqualTo(Nivel.PROVAVEL);
    }

    @Test
    void chave() {
        assertThat(CasamentoDeNomes.chave("Supino Reto c/ Barra (livre)")).isEqualTo("supino reto barra livre");
        assertThat(CasamentoDeNomes.chave("Flexões de braço")).isEqualTo("flexao braco");
        assertThat(CasamentoDeNomes.chave("  ")).isEmpty();
        assertThat(CasamentoDeNomes.singular("halteres")).isEqualTo("halter");
        assertThat(CasamentoDeNomes.singular("pes")).isEqualTo("pes");
        assertThat(CasamentoDeNomes.singular("barras")).isEqualTo("barra");
    }
}
