package br.com.treinos.api.unidadecarga;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A suíte liga {@code TREINOS_UNIDADE_CARGA_HABILITADA}: o {@code GET /eu} avisa o app de que a escolha de kg/lb existe. */
@AutoConfigureMockMvc
class UnidadeDeCargaLigadaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void euDizQueAEscolhaDeUnidadeEstaLigada() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Unidade Ligada");
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        assertThat(api.get("/eu", login, 200).get("unidadeDeCargaHabilitada").asBoolean()).isTrue();
    }
}
