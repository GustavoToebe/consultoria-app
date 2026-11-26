package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ia.ContextoIa;
import br.com.treinos.api.importacao.assistida.ia.InterpretadorPorRegras;
import br.com.treinos.api.importacao.assistida.ia.ResultadoInterpretacao;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InterpretadorPorRegrasTest {

    private final InterpretadorPorRegras interpretador = new InterpretadorPorRegras();

    @Test
    void interpretaTreinoEDietaComPrescricaoPadrao() {
        String texto = """
                Aluno: Mateus Oliveira
                Peso: 82.5 kg
                
                Treino A - Peito e Tríceps
                1. Supino reto - 4x10 - 60s
                2. Tríceps corda - 3x12 - 45s
                
                Café da Manhã
                3 un Ovos inteiros
                50g Aveia em flocos
                """;

        List<BlocoTexto> blocos = List.of(new BlocoTexto("Geral", texto, "Treino_Mateus.pdf", 1));
        ContextoIa contexto = new ContextoIa(
                "Treino_Mateus.pdf",
                "PDF",
                blocos,
                texto,
                "CADASTROS_E_PLANOS_ATUAIS",
                List.of("WS", "FS"),
                Map.of()
        );

        ResultadoInterpretacao res = interpretador.interpretar(contexto);

        assertThat(res.grupos()).hasSize(1);
        ResultadoInterpretacao.PropostaGrupo g = res.grupos().getFirst();
        assertThat(g.nomeAluno()).isEqualTo("Mateus Oliveira");
        assertThat(g.pesos()).hasSize(1);
        assertThat(g.pesos().getFirst().kg()).isEqualByComparingTo("82.5");
        // Sem data escrita na linha, a data fica nula: nunca se inventa "hoje" (a gravação ignora esse peso).
        assertThat(g.pesos().getFirst().data()).isNull();

        // Treino
        assertThat(g.treino()).isNotNull();
        assertThat(g.treino().sessoes()).hasSize(1);
        assertThat(g.treino().sessoes().getFirst().exercicios()).hasSize(2);
        assertThat(g.treino().sessoes().getFirst().exercicios().getFirst().nome()).contains("Supino reto");
        assertThat(g.treino().sessoes().getFirst().exercicios().getFirst().series()).hasSize(4);

        // Dieta
        assertThat(g.dieta()).isNotNull();
        assertThat(g.dieta().refeicoes()).hasSize(1);
        assertThat(g.dieta().refeicoes().getFirst().opcoes().getFirst().itens()).hasSize(2);
    }

    @Test
    void pesoComDataEscritaNaLinhaGuardaADataDaLinha() {
        String texto = "Aluno: Carla Souza\nPeso: 61,5 kg em 12/03/2026\n";
        ContextoIa contexto = new ContextoIa("carla.txt", "TEXTO_LIVRE",
                List.of(new BlocoTexto("Geral", texto, "carla.txt", 1)), texto, "CADASTROS_E_PLANOS_ATUAIS", List.of(), Map.of());

        ResultadoInterpretacao res = interpretador.interpretar(contexto);

        assertThat(res.grupos().getFirst().pesos()).hasSize(1);
        assertThat(res.grupos().getFirst().pesos().getFirst().data()).isEqualTo(java.time.LocalDate.of(2026, 3, 12));
        assertThat(res.grupos().getFirst().pesos().getFirst().kg()).isEqualByComparingTo("61.5");
    }

    private ResultadoInterpretacao interpretar(String texto) {
        return interpretador.interpretar(new ContextoIa("plano.pdf", "PDF",
                List.of(new BlocoTexto("Geral", texto, "plano.pdf", 1)), texto, "CADASTROS_E_PLANOS_ATUAIS", List.of(), Map.of()));
    }

    private static List<String> nomesDeExercicios(ResultadoInterpretacao res, int sessao) {
        return res.grupos().getFirst().treino().sessoes().get(sessao).exercicios().stream().map(e -> e.nome()).toList();
    }

    @Test
    void titulosDeColunaNaoViramExercicio() {
        ResultadoInterpretacao res = interpretar("""
                Segunda - Costas
                Exercício Séries Reps
                Exercícios 3x10
                Remada baixa 3x10
                """);

        assertThat(nomesDeExercicios(res, 0)).containsExactly("Remada baixa");
    }

    @Test
    void titulosDeColunaNaoViramAlimento() {
        ResultadoInterpretacao res = interpretar("""
                Café da Manhã
                2 un Alimento
                50g Aveia
                """);

        assertThat(res.grupos().getFirst().dieta().refeicoes().getFirst().opcoes().getFirst().itens())
                .extracting(i -> i.nome()).containsExactly("Aveia");
    }

    @Test
    void linhaComDoseDeSubstanciaNaoViraExercicioNemAlimento() {
        ResultadoInterpretacao res = interpretar("""
                Treino A - Peito
                Supino reto 3x10
                250 mg/sem - Substancia ficticia 2x
                1 ampola de Outra ficticia 3x8

                Café da Manhã
                50g Aveia
                10 ml Substancia ficticia 250 mg/sem
                """);

        assertThat(nomesDeExercicios(res, 0)).containsExactly("Supino reto");
        assertThat(res.grupos().getFirst().dieta().refeicoes().getFirst().opcoes().getFirst().itens()).hasSize(1);
    }

    @Test
    void nomeDeAlimentoSoComNumeroOuSinalNaoViraAlimentoNemDuvida() {
        ResultadoInterpretacao res = interpretar("""
                Café da Manhã
                50g Aveia
                1 un 0
                2 un -1
                3 un -2
                """);

        assertThat(res.grupos().getFirst().dieta().refeicoes().getFirst().opcoes().getFirst().itens()).hasSize(1);
        assertThat(res.duvidas()).extracting(d -> d.termoOriginal()).doesNotContain("0", "-1", "-2");
    }

    @Test
    void fraseDeInstrucaoNaoViraSessao() {
        ResultadoInterpretacao res = interpretar("""
                Segunda - Costas
                Remada baixa 3x10
                treino anterior. Por isso, pesos de 0,25 kg e até 0,5 kg não são descartados. O
                Treino B - Pernas
                Agachamento 4x8
                """);

        assertThat(res.grupos().getFirst().treino().sessoes()).hasSize(2);
        assertThat(nomesDeExercicios(res, 0)).containsExactly("Remada baixa");
        assertThat(nomesDeExercicios(res, 1)).containsExactly("Agachamento");
    }

    @Test
    void nomeQuebradoEmDuasLinhasFicaNumExercicioSo() {
        ResultadoInterpretacao res = interpretar("""
                Segunda - Costas
                Remada curvada no 2x10
                smith
                T Bar row (pegada 3x8
                neutra)
                Supino 3x10
                alongar bem
                """);

        assertThat(nomesDeExercicios(res, 0))
                .containsExactly("Remada curvada no smith", "T Bar row (pegada neutra)", "Supino");
    }
}
