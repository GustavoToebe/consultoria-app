package br.com.treinos.api.unidadecarga;

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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção: a escolha de kg ou lb fica no código, desligada ({@code TREINOS_UNIDADE_CARGA_HABILITADA=false}).
 * Nenhuma rota depende da chave; só o {@code GET /eu} diz ao app para esconder a escolha. A suíte liga a chave; só esta
 * classe a desliga.
 */
@AutoConfigureMockMvc
class UnidadeDeCargaDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarAUnidade(DynamicPropertyRegistry registry) {
        registry.add("treinos.unidade-carga.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void euDizQueAEscolhaDeUnidadeEstaDesligada() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Unidade Desligada");
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        assertThat(api.get("/eu", login, 200).get("unidadeDeCargaHabilitada").asBoolean()).isFalse();
        assertThat(api.get("/eu", treinador, 200).get("unidadeDeCargaHabilitada").asBoolean()).isFalse();
    }
}
