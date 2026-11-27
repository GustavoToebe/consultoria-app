package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.inscricoes.CodigoDeInscricao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Com {@code TREINOS_CONTRATOS_HABILITADO=false} a página pública do responsável e a rota do link dão 503 {@code CONTRATOS_INDISPONIVEL}. */
@AutoConfigureMockMvc
class ContratosPublicosDesligadosIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registro) {
        registro.add("treinos.contratos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void asQuatroRotasPublicasEOLinkDaEquipeDao503() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        Map<String, Object> corpo = Map.of("codigo", CodigoDeInscricao.novo(), "cpf", "000.000.000-00");

        for (String rota : new String[] {"consultar", "abrir", "arquivo", "assinar"}) {
            assertThat(api.post("/publico/contratos/" + rota, null, corpo, 503).get("codigo").asString())
                    .isEqualTo("CONTRATOS_INDISPONIVEL");
        }
        assertThat(api.post("/contratos/" + UUID.randomUUID() + "/link", admin, Map.of(), 503).get("codigo").asString())
                .isEqualTo("CONTRATOS_INDISPONIVEL");
    }
}
