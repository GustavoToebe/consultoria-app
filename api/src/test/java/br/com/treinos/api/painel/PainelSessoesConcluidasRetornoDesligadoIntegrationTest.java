package br.com.treinos.api.painel;

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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Com {@code TREINOS_RETORNO_HABILITADO=false} (o padrão de produção) a contagem de treinos concluídos do {@code GET /painel}
 * é {@code null}, nunca zero, mesmo para quem tem {@code REGISTRO_LER}. Fica numa classe à parte porque a chave só muda por
 * contexto de teste (a suíte a liga). O resto do painel segue igual.
 */
@AutoConfigureMockMvc
class PainelSessoesConcluidasRetornoDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarORetorno(DynamicPropertyRegistry registry) {
        registry.add("treinos.retorno.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void retornoDesligadoDeixaASessoesConcluidasNulaENaoZero() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        api.criarAluno(treinador, "Aluno Fictício do Painel");

        JsonNode painel = api.get("/painel", treinador, 200);
        assertThat(painel.has("sessoesConcluidas7Dias")).isTrue();
        assertThat(painel.path("sessoesConcluidas7Dias").isNull()).isTrue();
        assertThat(painel.path("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(painel.path("alunosSemRegistroTotal").asLong()).isEqualTo(1);
    }
}
