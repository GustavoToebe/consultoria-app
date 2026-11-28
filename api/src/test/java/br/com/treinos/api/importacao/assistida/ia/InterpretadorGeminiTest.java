package br.com.treinos.api.importacao.assistida.ia;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/** O esquema da proposta no formato do responseSchema do Gemini (subconjunto da OpenAPI). */
class InterpretadorGeminiTest {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void esquemaViraOpenApiSemTipoListaNemAdditionalProperties() {
        String texto = json.writeValueAsString(InterpretadorGemini.paraGemini(EsquemaDaProposta.paraClaude()));
        JsonNode raiz = json.readTree(texto);

        assertThat(texto).doesNotContain("additionalProperties").doesNotContain("\"null\"");
        assertThat(raiz.path("type").asText()).isEqualTo("OBJECT");
        assertThat(raiz.path("required").get(0).asText()).isEqualTo("grupos");
        JsonNode grupo = raiz.path("properties").path("grupos").path("items");
        assertThat(grupo.path("propertyOrdering").get(0).asText()).isEqualTo("nomeAluno");
        assertThat(grupo.path("properties").path("nomeAluno").path("type").asText()).isEqualTo("STRING");
        assertThat(grupo.path("properties").path("nomeAluno").path("nullable").asBoolean()).isTrue();
        assertThat(grupo.path("properties").path("treino").path("type").asText()).isEqualTo("OBJECT");
        assertThat(grupo.path("properties").path("treino").path("nullable").asBoolean()).isTrue();

        JsonNode sessao = grupo.path("properties").path("treino").path("properties").path("sessoes").path("items");
        // Enum de número (dia da semana) vira inteiro anulável; enum de texto (técnica) fica enum.
        assertThat(sessao.path("properties").path("diaSemana").path("type").asText()).isEqualTo("INTEGER");
        assertThat(sessao.path("properties").path("diaSemana").has("enum")).isFalse();
        JsonNode serie = sessao.path("properties").path("exercicios").path("items").path("properties").path("series").path("items");
        JsonNode tecnica = serie.path("properties").path("tecnica");
        assertThat(tecnica.path("type").asText()).isEqualTo("STRING");
        assertThat(tecnica.path("format").asText()).isEqualTo("enum");
        assertThat(tecnica.path("nullable").asBoolean()).isTrue();
        assertThat(tecnica.path("enum").size()).isEqualTo(3);
    }

    @Test
    void tempoDaChamadaDoGeminiNaoPassaDoClaude() {
        // O corte do arquivo e da sessão sai do tempo do Claude: o Gemini não pode demorar mais que ele.
        assertThat(InterpretadorGemini.TIMEOUT_HTTP).isLessThanOrEqualTo(InterpretadorClaude.TIMEOUT_HTTP)
                .isGreaterThan(java.time.Duration.ofMinutes(1));
    }
}
