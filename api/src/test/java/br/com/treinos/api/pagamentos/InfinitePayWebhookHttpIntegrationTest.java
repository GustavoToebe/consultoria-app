package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O aviso da InfinitePay chega como chega de verdade: um servidor HTTP real (Tomcat, porta aleatória) e um cliente cru, sem
 * cookie, sem {@code Authorization}, sem {@code X-XSRF-TOKEN}, sem {@code X-Treinos-Cliente} e sem {@code Origin}. O
 * {@code ApiDeTeste} anexa cabeçalhos de cliente do app; aqui ele só prepara a conta. Prova que {@code /publico/**} não pede
 * CSRF nem login, que o tipo do corpo não importa (a InfinitePay não promete {@code application/json}) e que o aviso grava.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class InfinitePayWebhookHttpIntegrationTest extends AbstractIntegrationTest {

    private static final String CAMINHO = "/publico/pagamentos/infinitepay/";

    @LocalServerPort private int porta;
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
    private UUID consultoria;
    private String token;

    @BeforeEach
    void preparar() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode login = api.novoTreinador();
        api.put("/financeiro/recebimento-online", login, Map.of("infiniteTag", "treinador-fake"), 200);
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
        token = jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?", String.class,
                consultoria);
    }

    @AfterEach
    void deixarNeutro() {
        // A rodada do conciliador é global: o aviso deste teste não pode ser consultado por outras classes.
        jdbc.update("update aviso_de_pagamento set situacao = 'IGNORADO', reservado_por = null, reserva_ate = null "
                + "where consultoria_id = ? and situacao = 'PENDENTE'", consultoria);
    }

    /** POST cru: só o que o cliente da InfinitePay manda, e o {@code Content-Type} dado (nenhum quando nulo). */
    private HttpResponse<String> avisar(String tipoDoCorpo, String corpo) throws Exception {
        HttpRequest.Builder pedido = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + porta + CAMINHO + token))
                .POST(HttpRequest.BodyPublishers.ofString(corpo, StandardCharsets.UTF_8));
        if (tipoDoCorpo != null) {
            pedido.header("Content-Type", tipoDoCorpo);
        }
        return http.send(pedido.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String aviso(String transacao) {
        return "{\"order_nsu\":\"" + UUID.randomUUID() + "\",\"transaction_nsu\":\"" + transacao + "\",\"amount\":15000}";
    }

    private int gravados(String transacao) {
        Integer n = jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                Integer.class, consultoria, transacao);
        return n == null ? 0 : n;
    }

    @Test
    void avisoCruComJsonTextoOuSemTipoDeCorpoResponde200EGravaSemCsrfNemLogin() throws Exception {
        // Formulário (application/x-www-form-urlencoded) fica de fora de propósito: o Tomcat consome o corpo ao ler parâmetros
        // e o aviso chegaria vazio (400). A InfinitePay documenta o aviso como JSON, então não é um caso real.
        for (String tipo : new String[] {"application/json", "text/plain", null}) {
            String transacao = "TX-HTTP-" + UUID.randomUUID();

            HttpResponse<String> resposta = avisar(tipo, aviso(transacao));

            assertThat(resposta.statusCode()).as("Content-Type %s", tipo).isEqualTo(200);
            assertThat(resposta.body()).as("Content-Type %s", tipo).isEmpty();
            assertThat(gravados(transacao)).as("Content-Type %s", tipo).isEqualTo(1);
        }
    }

    @Test
    void tokenDesconhecidoDa404MesmoSemCsrf() throws Exception {
        HttpResponse<String> resposta = http.send(HttpRequest.newBuilder(
                        URI.create("http://127.0.0.1:" + porta + CAMINHO + "Z".repeat(43)))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{}")).build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(resposta.statusCode()).isEqualTo(404);
    }
}
