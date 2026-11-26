package br.com.treinos.api.importacao.assistida.ia;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Termo de dúvida sem letra nem dígito ("", "**", "-", "—") não vira dúvida; a regra é aplicada em `ImportacaoAssistidaService`. */
class DecodificadorDaPropostaTest {

    @Test
    void semConteudoReconheceLetraEDigito() {
        assertThat(TermoDeDuvida.semConteudo(null)).isTrue();
        assertThat(TermoDeDuvida.semConteudo("")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("   ")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("**")).isTrue();
        assertThat(TermoDeDuvida.semConteudo(" — * ")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("(…)")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("21")).isFalse();
        assertThat(TermoDeDuvida.semConteudo("Remada")).isFalse();
    }

    @Test
    void camposNovosEAvisosDeCorteVoltamNaProposta() {
        tools.jackson.databind.json.JsonMapper json = tools.jackson.databind.json.JsonMapper.builder().build();
        String exercicios = java.util.stream.IntStream.range(0, 45)
                .mapToObj(i -> "{\"nome\": \"Ex " + i + "\", \"series\": [{\"quantidade\": 1, \"repsMin\": 8}]}")
                .collect(java.util.stream.Collectors.joining(","));
        tools.jackson.databind.JsonNode raiz = json.readTree("""
                {"grupos": [{"nomeAluno": "Fulano Teste",
                  "treino": {"sessoes": [{"nome": "Treino A", "exercicios": [
                    {"nome": "Supino", "cadencia": "3-0-1-0", "isometriaSegundos": 2, "series": [
                      {"quantidade": 1, "tipo": "WS", "repsMin": 8, "repsMax": 8, "tecnica": "REST_PAUSE", "pausas": 2}]},
                    {"nome": "Remada", "cadencia": "lenta", "series": [{"quantidade": 1}]}, %s]}]},
                  "dieta": {"aguaLitros": 3.2, "refeicoes": [
                    {"nome": "Cafe", "modoDePreparo": "Bater tudo.", "itens": [{"nome": "Ovo"}]}]}}]}"""
                .formatted(exercicios));
        ContextoIa ctx = new ContextoIa("a.pdf", "PDF", java.util.List.of(), "texto", null, java.util.List.of(),
                java.util.Map.of());

        ResultadoInterpretacao.PropostaGrupo g = DecodificadorDaProposta.decodificar(json, raiz, ctx).grupos().getFirst();

        var exercicioDoSupino = g.treino().sessoes().getFirst().exercicios().getFirst();
        assertThat(exercicioDoSupino.cadencia()).isEqualTo("3-0-1-0");
        assertThat(exercicioDoSupino.isometriaSegundos()).isEqualTo(2);
        assertThat(exercicioDoSupino.series().getFirst().tecnica().tipo()).isEqualTo("REST_PAUSE");
        assertThat(exercicioDoSupino.series().getFirst().tecnica().pausas()).isEqualTo(2);
        // Cadência fora do formato 0-9/X com hífen é descartada, nunca inventada.
        assertThat(g.treino().sessoes().getFirst().exercicios().get(1).cadencia()).isNull();
        assertThat(g.dieta().aguaLitros()).isEqualByComparingTo("3.2");
        assertThat(g.dieta().refeicoes().getFirst().modoDePreparo()).isEqualTo("Bater tudo.");
        // 47 exercícios lidos, teto de 40: o corte vira aviso por grupo.
        assertThat(g.treino().sessoes().getFirst().exercicios()).hasSize(40);
        assertThat(g.avisos()).isNotEmpty();
    }
}
