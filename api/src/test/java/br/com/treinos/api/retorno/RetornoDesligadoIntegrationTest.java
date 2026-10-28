package br.com.treinos.api.retorno;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção: "Concluir treino" fica no código, desligado ({@code TREINOS_RETORNO_HABILITADO=false}). Toda rota
 * dele (aluno e treinador, leitura inclusive) responde 503 {@code RETORNO_INDISPONIVEL} e o {@code GET /eu} diz ao app para
 * esconder tudo. A suíte liga a chave; só esta classe a desliga.
 */
@AutoConfigureMockMvc
class RetornoDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarORetorno(DynamicPropertyRegistry registry) {
        registry.add("treinos.retorno.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void rotasDoRetornoRespondem503EEuDizQueEstaDesligado() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Retorno Desligado");
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        assertThat(api.post("/aluno/sessoes-concluidas", login, Map.of("registros", List.of()), 503).path("codigo").asString())
                .isEqualTo("RETORNO_INDISPONIVEL");
        assertThat(api.get("/aluno/sessoes-concluidas", login, 503).path("codigo").asString()).isEqualTo("RETORNO_INDISPONIVEL");
        assertThat(api.get("/alunos/" + aluno + "/sessoes-concluidas", treinador, 503).path("codigo").asString())
                .isEqualTo("RETORNO_INDISPONIVEL");
        // Engajamento 0.5: "Visto" e recordes da semana também.
        assertThat(api.put("/alunos/" + aluno + "/sessoes-concluidas/" + UUID.randomUUID() + "/visto", treinador, Map.of(), 503)
                .path("codigo").asString()).isEqualTo("RETORNO_INDISPONIVEL");
        assertThat(api.get("/recordes/semana", treinador, 503).path("codigo").asString()).isEqualTo("RETORNO_INDISPONIVEL");
        assertThat(api.get("/alunos/" + aluno + "/recordes/semana", treinador, 503).path("codigo").asString())
                .isEqualTo("RETORNO_INDISPONIVEL");

        assertThat(api.get("/eu", login, 200).get("retornoHabilitado").asBoolean()).isFalse();
        assertThat(api.get("/eu", treinador, 200).get("retornoHabilitado").asBoolean()).isFalse();
    }

    /** Recordes pessoais (Engajamento 0.2): com a chave desligada o pacote do aluno não traz a lista (nem o campo). */
    @Test
    void pacoteDoAlunoSemRecordes() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Recordes Desligados");
        api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo());
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        JsonNode painel = api.get("/aluno/painel", login, 200);
        assertThat(painel.get("treino").isNull()).isFalse();
        assertThat(painel.has("recordes")).isFalse();
        assertThat(painel.has("anteriores")).isFalse();
    }
}
