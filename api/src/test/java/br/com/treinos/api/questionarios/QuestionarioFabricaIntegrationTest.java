package br.com.treinos.api.questionarios;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.planos.ResultadoValidacao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O questionário de fábrica (v2 da V024, de onde sai o Padrão de cada consultoria) tem de ser publicável e igual ao
 * que o TypeScript valida na fixture {@code fabrica_v2}. Sem dado de aluno.
 */
class QuestionarioFabricaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate banco;
    @Autowired private JsonMapper json;
    @Autowired private ValidadorQuestionario validador;

    @Test
    void fabricaV2EPublicavelEIgualAFixtureDeParidade() throws IOException {
        String texto = banco.queryForObject("select conteudo::text from atualizacao_modelo where versao = 2", String.class);
        JsonNode doBanco = json.readTree(texto);

        ResultadoValidacao r = validador.validar(json.treeToValue(doBanco, ConteudoQuestionario.class));
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).isEmpty();

        JsonNode fixture;
        try (InputStream in = getClass().getResourceAsStream("/paridade-questionario/questionarios.json")) {
            assertThat(in).isNotNull();
            fixture = json.readTree(in);
        }
        JsonNode esperado = fixture.valueStream().filter(c -> "fabrica_v2".equals(c.path("nome").asString()))
                .findFirst().orElseThrow().path("conteudo");
        assertThat(doBanco).isEqualTo(esperado);
    }
}
