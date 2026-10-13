package br.com.treinos.api.demo;

import br.com.treinos.api.biblioteca.Exercicio;

import java.util.List;

/**
 * Plano 16 do Saraiva, montado a partir do PDF do treino, no formato do {@code ConteudoTreino}.
 * Só a estrutura do treino: nenhum dado pessoal. Séries numa notação curta para caber numa linha:
 * {@code A10-15} aquecimento; {@code F3@50} FS de 3 reps a 50% da WS ({@code F3-5@70} = 3 a 5 reps); {@code W3-6}
 * série de trabalho; {@code B6-8@85} back off a 85% da WS.
 *
 * <p>Quinta como "Off ativo" (o PDF tem um título "Quarta - Off ativo" que contradiz o resumo; pendência para o
 * Saraiva).</p>
 */
final class Plano16 {

    /** "Falha" ou "1 RIR" vêm do texto de reps do PDF e viram observação, não número. */
    enum Limite { FALHA, UM_RIR, NENHUM }

    record Ex(String nome, Exercicio.Modalidade modalidade, String observacao, Limite limite, boolean progressao,
              String unidade, List<String> series) {
    }

    record Dia(String nome, int diaSemana, String tipo, String cardio, List<Ex> exercicios) {
    }

    static final String CARDIO = "Cardio 50 min livre ou HIIT de 25 min (1 min forte + 1 min leve), BPM 140 a 150";

    private static final Exercicio.Modalidade MAQ = Exercicio.Modalidade.MAQUINA;
    private static final Exercicio.Modalidade LIVRE = Exercicio.Modalidade.LIVRE;

    private Plano16() {
    }

    static List<Dia> dias() {
        return List.of(
                new Dia("Segunda - Costas", 1, "TREINO", null, List.of(
                        ex("Remada baixa na polia unilateral", MAQ, "Tronco levemente inclinado para o lado.", Limite.FALHA,
                                "A10-15", "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Puxada alta com pegada romana (neutra)", MAQ, null, Limite.FALHA,
                                "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Remada na máquina com pegada neutra (unilateral)", MAQ, null, Limite.FALHA,
                                "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Elevação lateral com halteres", LIVRE, null, Limite.UM_RIR,
                                "F3@70", "F3@85", "W6-8", "W6-8", "W6-8"))),
                new Dia("Terça - Peito+Ombros", 2, "TREINO", null, List.of(
                        ex("Supino reto na máquina (sentado)", MAQ, null, Limite.FALHA,
                                "A10-15", "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Supino inclinado na máquina", MAQ, null, Limite.FALHA,
                                "F3-5@70", "F3-5@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Desenvolvimento na máquina articulada (pegada neutra)", MAQ, "Prefira pegada neutra.",
                                Limite.FALHA, "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Tríceps na polia com corda", MAQ, null, Limite.NENHUM,
                                "F3@70", "F3@85", "W6-8", "W6-8", "B8-10@90"),
                        ex("Tríceps cruzado na polia (unilateral)", MAQ, null, Limite.NENHUM,
                                "F3@85", "W6-8", "W6-8"))),
                new Dia("Quarta - Pernas", 3, "TREINO", null, List.of(
                        new Ex("Clamshell (com band)", Exercicio.Modalidade.ELASTICO, null, Limite.NENHUM, true,
                                "nenhuma", List.of("W8-10", "W8-10", "W8-10")),
                        ex("Mesa flexora", MAQ, null, Limite.NENHUM,
                                "F3-5@50", "F3-5@70", "F3-5@85", "W3-6", "B6-8@90", "B6-8@90"),
                        ex("Cadeira flexora", MAQ, null, Limite.NENHUM,
                                "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@90"),
                        ex("Leg press horizontal", MAQ, null, Limite.NENHUM,
                                "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        new Ex("Elevação pélvica na máquina ou com barra", MAQ,
                                "Carga baixa, controle extremo. O objetivo não é progressão de carga.", Limite.NENHUM,
                                false, "kg", List.of("F3-5@70", "F3-5@85", "W6-8", "W6-8")))),
                new Dia("Quinta - Off ativo", 4, "DESCANSO_ATIVO", CARDIO, List.of()),
                new Dia("Sexta - Upper", 5, "TREINO", null, List.of(
                        ex("Remada na máquina articulada (pegada pronada simultâneo)", MAQ, null, Limite.NENHUM,
                                "A5-10", "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Supino inclinado no smith (banco em 30º)", MAQ, null, Limite.NENHUM,
                                "F3@50", "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("High row (unilateral)", MAQ, null, Limite.NENHUM,
                                "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Tríceps na polia com corda", MAQ, null, Limite.NENHUM,
                                "F3@70", "F3@85", "W3-6", "B6-8@85", "B6-8@85"),
                        ex("Elevação lateral na máquina", MAQ, "Mantenha os braços esticados.", Limite.NENHUM,
                                "F3-5@85", "W6-8", "W6-8", "W6-8"))),
                new Dia("Sábado - Pernas", 6, "TREINO", null, List.of(
                        ex("Cadeira flexora", MAQ, null, Limite.NENHUM,
                                "A5-10", "F3-5@50", "F3-5@70", "F3-5@85", "W3-6", "B6-8@90", "B6-8@90"),
                        ex("Stiff com barra livre", LIVRE, "Controle durante flexão e extensão do quadril.", Limite.UM_RIR,
                                "F3-5@50", "F3-5@70", "F3-5@85", "W6-8", "W6-8"),
                        new Ex("Leg press 45º", MAQ, "Extremamente controlado. O objetivo não é progressão de carga.",
                                Limite.NENHUM, false, "kg", List.of("F3-5@70", "F3-5@85", "W6-8", "W6-8")),
                        ex("Abdução de quadril na polia", MAQ, "Movimento bem curto.", Limite.NENHUM,
                                "F3-5@85", "W6-8", "W6-8"))),
                new Dia("Domingo - Off ativo", 7, "DESCANSO_ATIVO", CARDIO, List.of()));
    }

    /** Sessão de acessórios: sem dia fixo, 2x na semana no fim do treino. */
    static Ex abdominal() {
        return new Ex("Abdominal supra", MAQ,
                "Máquina de preferência ou polia alta com corda. Comece com carga alta desde a primeira série.",
                Limite.NENHUM, true, "kg", List.of("W6-8", "W6-8"));
    }

    /** Texto de instruções do PDF do treino (resumo das regras do Saraiva). */
    static final String INSTRUCOES = """
            Feeder Set (FS): série de reconhecimento. O objetivo é aumentar a carga a cada série dentro das reps \
            propostas para buscar a série de trabalho (WS). Não pode chegar na falha.
            Cálculo FS: se 3 FS, 1º 50% | 2º 70% | 3º 85~90% da WS. Se 2 FS, 1º 70% | 2º 85~90% da WS. Se 1 FS, 85% da WS.
            Working Set (WS): série de trabalho. Utilizar a carga máxima do dia nas reps propostas. Se passar do \
            número, aumentar carga na semana seguinte. Deve estar pesada a ponto da última rep ser difícil.
            Pesos livres: 1 RIR. Máquinas: até a falha.
            Back off: percentual do maior peso feito na WS.
            Anote a carga de cada série no app.""";

    private static Ex ex(String nome, Exercicio.Modalidade modalidade, String observacao, Limite limite,
                         String... series) {
        return new Ex(nome, modalidade, observacao, limite, true, "kg", List.of(series));
    }
}
