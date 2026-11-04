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
 * O questionário de fábrica (de onde sai o Padrão de cada consultoria) tem de ser publicável e igual ao
 * que o TypeScript valida na fixture {@code fabrica_v2}. Sem dado de aluno.
 */
class QuestionarioFabricaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate banco;
    @Autowired private JsonMapper json;
    @Autowired private ValidadorQuestionario validador;

    @Test
    void fabricaV2EPublicavelEIgualAFixtureDeParidade() throws IOException {
        conferir(2, "fabrica_v2");
    }

    /** V058: a fábrica de onde nascem as consultorias novas, com o cartão "Seu envio". */
    @Test
    void fabricaV3EPublicavelEIgualAFixtureDeParidadeEEAMaisRecente() throws IOException {
        conferir(3, "fabrica_v3");
        assertThat(banco.queryForObject("select max(versao) from atualizacao_modelo", Integer.class)).isEqualTo(3);
        assertThat(banco.queryForObject("select conteudo->'secoes'->0->>'titulo' from atualizacao_modelo where versao = 3", String.class))
                .isEqualTo("Seu envio");
    }

    private void conferir(int versao, String nomeDaFixture) throws IOException {
        String texto = banco.queryForObject("select conteudo::text from atualizacao_modelo where versao = ?", String.class, versao);
        JsonNode doBanco = json.readTree(texto);

        ResultadoValidacao r = validador.validar(json.treeToValue(doBanco, ConteudoQuestionario.class));
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).isEmpty();

        JsonNode fixture;
        try (InputStream in = getClass().getResourceAsStream("/paridade-questionario/questionarios.json")) {
            assertThat(in).isNotNull();
            fixture = json.readTree(in);
        }
        JsonNode esperado = fixture.valueStream().filter(c -> nomeDaFixture.equals(c.path("nome").asString()))
                .findFirst().orElseThrow().path("conteudo");
        assertThat(doBanco).isEqualTo(esperado);
    }
}
