package br.com.treinos.api.ciclo;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção desde 27/10: o ciclo menstrual fica no código, desligado. Toda rota dele (aluna e treinador,
 * leitura inclusive) responde 503 e o {@code GET /eu} diz ao app para esconder tudo. O sexo continua funcionando.
 */
@AutoConfigureMockMvc
class CicloDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarOCiclo(DynamicPropertyRegistry registry) {
        registry.add("treinos.ciclo.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void rotasDoCicloRespondem503EEuDizQueEstaDesligado() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluna = api.criarAluno(treinador, "Aluna Fictícia Ciclo Desligado");
        JsonNode ficha = api.get("/alunos/" + aluna, treinador, 200);
        api.put("/alunos/" + aluna, treinador, Map.of("nome", ficha.path("nome").asString(),
                "versao", ficha.path("versao").asLong(), "sexo", "FEMININO"), 200);
        JsonNode login = api.convidarEEntrar(treinador, aluna);
        String hoje = LocalDate.now(Fuso.BRASILIA).toString();

        assertThat(api.get("/aluno/ciclo", login, 503).path("codigo").asString()).isEqualTo("CICLO_INDISPONIVEL_NO_APP");
        api.post("/aluno/ciclo/ativar", login, Map.of("consentimentoVersao", CicloMenstrual.VERSAO_CONSENTIMENTO), 503);
        api.post("/aluno/ciclo/registros", login, Map.of("id", UUID.randomUUID(), "inicio", hoje), 503);
        api.delete("/aluno/ciclo", login, 503);
        assertThat(api.get("/alunos/" + aluna + "/ciclo", treinador, 503).path("codigo").asString())
                .isEqualTo("CICLO_INDISPONIVEL_NO_APP");

        assertThat(api.get("/eu", login, 200).get("cicloHabilitado").asBoolean()).isFalse();
        assertThat(api.get("/eu", treinador, 200).get("cicloHabilitado").asBoolean()).isFalse();
        // O sexo não depende do ciclo: a ficha continua gravando e mostrando.
        assertThat(api.get("/alunos/" + aluna, treinador, 200).path("sexo").asString()).isEqualTo("FEMININO");
    }
}
