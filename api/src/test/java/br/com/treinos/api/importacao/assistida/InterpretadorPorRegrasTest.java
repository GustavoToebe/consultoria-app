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
}
