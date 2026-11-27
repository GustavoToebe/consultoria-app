package br.com.treinos.api.pagamentos;

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
 * O padrão da produção desde 01/12: {@code TREINOS_PAGAMENTOS_HABILITADO} ligado e nenhuma variável de provedor (chaves de cifra e
 * URL pública vazias; InfinitePay, Kiwify e Asaas desligados). A API sobe, o financeiro com baixa manual responde e só as rotas do
 * recebimento online dão 503.
 */
@AutoConfigureMockMvc
class PagamentosLigadosSemVariaveisIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void comoAProducao(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.habilitado", () -> "true");
        registry.add("treinos.pagamentos.chaves", () -> "");
        registry.add("treinos.pagamentos.chave-ativa", () -> "");
        registry.add("treinos.pagamentos.infinitepay.habilitado", () -> "false");
        registry.add("treinos.pagamentos.infinitepay.url-publica", () -> "");
        registry.add("treinos.pagamentos.kiwify.habilitado", () -> "false");
        registry.add("treinos.pagamentos.asaas.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void sobeSemVariaveisEOFinanceiroManualResponde() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();

        JsonNode eu = api.get("/eu", admin, 200);
        assertThat(eu.get("pagamentosHabilitados").asBoolean()).isTrue();
        assertThat(eu.get("recebimentoOnlineHabilitado").asBoolean()).isFalse();

        api.get("/financeiro/cobrancas", admin, 200);
        api.get("/financeiro/formas-de-recebimento", admin, 200);
        assertThat(api.get("/financeiro/recebimento-online", admin, 503).path("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
    }
}
