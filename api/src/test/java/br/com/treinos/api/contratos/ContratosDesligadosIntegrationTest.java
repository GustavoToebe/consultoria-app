package br.com.treinos.api.contratos;

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

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Com {@code TREINOS_CONTRATOS_HABILITADO=false} toda rota de contrato dá 503 e o {@code GET /eu} avisa o app. */
@AutoConfigureMockMvc
class ContratosDesligadosIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registro) {
        registro.add("treinos.contratos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void todaRotaDeContratoDa503ComOCodigoProprioEOEuDizQueEstaDesligado() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        UUID qualquer = UUID.randomUUID();

        assertThat(api.get("/eu", admin, 200).get("contratosHabilitados").asBoolean()).isFalse();

        for (JsonNode erro : new JsonNode[]{
                api.get("/contratos/modelos", admin, 503),
                api.post("/contratos/modelos", admin, Map.of("nome", "x", "texto", "y"), 503),
                api.put("/contratos/modelos/" + qualquer, admin, Map.of("nome", "x", "texto", "y"), 503),
                api.post("/contratos/modelos/" + qualquer + "/arquivar", admin, Map.of("versao", 0), 503),
                api.post("/contratos/modelos/" + qualquer + "/previa", admin, Map.of(), 503),
                api.get("/alunos/" + aluno + "/contratos", admin, 503),
                api.get("/contratos/" + qualquer, admin, 503),
                api.post("/alunos/" + aluno + "/contratos/previa", admin, Map.of("modeloId", qualquer.toString()), 503),
                api.post("/alunos/" + aluno + "/contratos", admin, Map.of("pedidoId", qualquer.toString(), "modeloId", qualquer.toString()), 503),
                api.post("/contratos/" + qualquer + "/cancelar", admin, Map.of("motivo", "x", "versao", 0), 503),
                api.post("/contratos/" + qualquer + "/prorrogar", admin, Map.of("dias", 1, "versao", 0), 503),
                api.get("/aluno/contratos", loginDoAluno, 503),
                api.get("/aluno/contratos/" + qualquer, loginDoAluno, 503),
                api.post("/aluno/contratos/" + qualquer + "/assinar", loginDoAluno, Map.of("sha256", "x", "nome", "y", "aceite", true), 503)}) {
            assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATOS_INDISPONIVEL");
        }
        // A exportação e a anonimização seguem valendo com o módulo desligado.
        api.get("/alunos/" + aluno + "/exportacao", admin, 200);
    }
}
