package br.com.treinos.api.biblioteca;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExpansorTermosExercicioTest {

    @Test
    void traduzTermosCompostosESimples() {
        assertThat(ExpansorTermosExercicio.traduzir("barbell bench press")).isEqualTo("barra supino");
        assertThat(ExpansorTermosExercicio.traduzir("lat pulldown")).isEqualTo("puxada");
        assertThat(ExpansorTermosExercicio.traduzir("hip thrust")).isEqualTo("elevacao pelvica");
        assertThat(ExpansorTermosExercicio.traduzir("romanian deadlift")).isEqualTo("stiff");
        assertThat(ExpansorTermosExercicio.traduzir("rdl")).isEqualTo("stiff");
        assertThat(ExpansorTermosExercicio.traduzir("bulgarian split squat")).isEqualTo("agachamento bulgaro");
        assertThat(ExpansorTermosExercicio.traduzir("bicep curl")).isEqualTo("rosca direta");
        assertThat(ExpansorTermosExercicio.traduzir("tricep pushdown")).isEqualTo("triceps polia");
        assertThat(ExpansorTermosExercicio.traduzir("skull crusher")).isEqualTo("triceps testa");
        assertThat(ExpansorTermosExercicio.traduzir("crunch")).isEqualTo("abdominal");
        assertThat(ExpansorTermosExercicio.traduzir("plank")).isEqualTo("prancha");
    }

    @Test
    void casouComTermosEmIngles() {
        Exercicio supino = new Exercicio("Supino reto com barra", "Peito", null, Exercicio.Modalidade.LIVRE, null, null, Exercicio.Origem.MANUAL);
        assertThat(ExpansorTermosExercicio.casou(supino, "bench press")).isTrue();
        assertThat(ExpansorTermosExercicio.casou(supino, "barbell bench press")).isTrue();
        assertThat(ExpansorTermosExercicio.casou(supino, "squat")).isFalse();

        Exercicio puxada = new Exercicio("Puxada frontal na polia", "Costas", null, Exercicio.Modalidade.MAQUINA, null, null, Exercicio.Origem.MANUAL);
        assertThat(ExpansorTermosExercicio.casou(puxada, "lat pulldown")).isTrue();

        Exercicio elevacao = new Exercicio("Elevação pélvica", "Glúteo", null, Exercicio.Modalidade.LIVRE, null, null, Exercicio.Origem.MANUAL);
        assertThat(ExpansorTermosExercicio.casou(elevacao, "hip thrust")).isTrue();
        assertThat(ExpansorTermosExercicio.casou(elevacao, "glute bridge")).isTrue();

        Exercicio stiff = new Exercicio("Stiff com halteres", "Posterior", null, Exercicio.Modalidade.LIVRE, null, null, Exercicio.Origem.MANUAL);
        assertThat(ExpansorTermosExercicio.casou(stiff, "rdl")).isTrue();
        assertThat(ExpansorTermosExercicio.casou(stiff, "romanian deadlift")).isTrue();
    }
}
