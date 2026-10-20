package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pagamentos ligados e InfinitePay desligada: só o recebimento online responde 503 (RECEBIMENTO_ONLINE_INDISPONIVEL) e o
 * resto do financeiro segue normal. É o segundo passo da produção: sem chaves de cifra nem URL pública (aqui esvaziadas),
 * porque desligada a InfinitePay não exige variável nenhuma, nem confere as credenciais gravadas por outras classes no banco.
 */
@AutoConfigureMockMvc
class InfinitePayDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarAInfinitePay(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.habilitado", () -> "false");
        registry.add("treinos.pagamentos.chaves", () -> "");
        registry.add("treinos.pagamentos.chave-ativa", () -> "");
        registry.add("treinos.pagamentos.infinitepay.url-publica", () -> "");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @Test
    void recebimentoOnlineRespondeIndisponivelEOFinanceiroSegueNormal() throws Exception {
        String rota = "/financeiro/recebimento-online";

        assertThat(api.get(rota, admin, 503).path("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
        assertThat(api.put(rota, admin, Map.of("infiniteTag", "treinador-fake"), 503).path("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
        assertThat(api.delete(rota, admin, 503).path("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");

        JsonNode eu = api.get("/eu", admin, 200);
        assertThat(eu.get("pagamentosHabilitados").asBoolean()).isTrue();
        assertThat(eu.get("recebimentoOnlineHabilitado").asBoolean()).isFalse();
        api.get("/financeiro/planos", admin, 200);
        api.post("/financeiro/planos", admin, Map.of("nome", "Plano fictício InfinitePay desligada", "valorCentavos", 10000,
                "periodicidade", "MENSAL"), 200);
    }

    @Test
    void avisoPublicoEConferenciasRespondemIndisponivelSemGravarNada() throws Exception {
        String token = "B".repeat(43);

        var aviso = mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/infinitepay/" + token)
                .contentType("application/json")
                .content("{\"order_nsu\":\"" + UUID.randomUUID() + "\",\"transaction_nsu\":\"TX-DESLIGADA\"}")).andReturn().getResponse();

        assertThat(aviso.getStatus()).isEqualTo(503);
        assertThat(json.readTree(aviso.getContentAsString()).path("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento where transacao = 'TX-DESLIGADA'", Integer.class))
                .isZero();
        assertThat(api.get("/financeiro/conferencias", admin, 503).path("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
        assertThat(api.post("/financeiro/conferencias/" + UUID.randomUUID() + "/conferido", admin, Map.of(), 503)
                .path("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
    }

    @Test
    void linkDePagamentoRespondeIndisponivelEAAreaFinanceiraDoAlunoSegueLendo() throws Exception {
        UUID cobranca = UUID.randomUUID();
        JsonNode login = api.convidarEEntrar(admin, api.criarAluno(admin, "Aluno Fictício Desligada " + UUID.randomUUID()));

        assertThat(api.post("/cobrancas/" + cobranca + "/link", admin, Map.of(), 503).path("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobranca + "/link", login, Map.of(), 503).path("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
        assertThat(api.get("/aluno/financeiro", login, 200).get("pagamentoOnline").asBoolean()).isFalse();
    }
}
