package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
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

/**
 * As chaves da plataforma {@code TREINOS_PAGAMENTOS_PAGAR_NO_IOS} e {@code _ANDROID} ligadas: {@code GET /eu} as repassa ao app.
 * É só informação de tela (o app decide mostrar o "Pagar" no celular); nenhuma rota é bloqueada ou liberada por elas. O padrão
 * desligado está em {@code PagamentosIntegrationTest}.
 */
@AutoConfigureMockMvc
class PagarNoCelularLigadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void ligarAsDuasChaves(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.pagar-no-ios", () -> "true");
        registry.add("treinos.pagamentos.pagar-no-android", () -> "true");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @Test
    void euRepassaAsChavesLigadasParaTreinadorEAluno() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        JsonNode loginAluno = api.convidarEEntrar(admin, aluno);

        for (JsonNode login : new JsonNode[] {admin, loginAluno}) {
            JsonNode eu = api.get("/eu", login, 200);
            assertThat(eu.get("pagarNoIos").asBoolean()).isTrue();
            assertThat(eu.get("pagarNoAndroid").asBoolean()).isTrue();
        }
    }

    @Test
    void ligarAsChavesNaoMudaNenhumaRotaDoFinanceiro() throws Exception {
        // Só UI: o financeiro responde igual com as chaves ligadas.
        api.get("/financeiro/planos", admin, 200);
        api.post("/financeiro/planos", admin, Map.of("nome", "Plano fictício celular", "valorCentavos", 10000,
                "periodicidade", "MENSAL"), 200);
        api.get("/financeiro/conferencias", admin, 200);
    }
}
