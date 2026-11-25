package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Webhook público do Asaas ({@code POST /publico/pagamentos/asaas/{tokenCaminho}}) testado via HTTP cru
 * ({@code HttpClient}, sem JWT/CSRF): teto de 16 KiB (413), token inválido (401), token desconhecido (404),
 * rotação de token com janela de 24h (200), e webhook de cobrança teste R$ 5,00 promovendo {@code SubcontaAsaas}
 * automaticamente para {@code ATIVA}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class AsaasWebhookHttpIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA_WEBHOOK = "/publico/pagamentos/asaas/";
    private static final String ROTA_CONFIG = "/financeiro/overtraining-pay";
    private static final String CHAVE_MATRIZ = "chave-matriz-webhook-http-asaas-teste";

    private static final AsaasFalsa ASAAS = new AsaasFalsa();

    @DynamicPropertySource
    static void configurarAsaas(DynamicPropertyRegistry r) {
        r.add("treinos.pagamentos.asaas.habilitado", () -> "true");
        r.add("treinos.pagamentos.asaas.url-base", ASAAS::url);
        r.add("treinos.pagamentos.asaas.api-key-matriz", () -> CHAVE_MATRIZ);
        r.add("treinos.pagamentos.asaas.url-publica", () -> "https://api.teste.local");
        r.add("treinos.pagamentos.asaas.wallet-matriz", () -> "wal_matriz_wh");
        r.add("treinos.pagamentos.asaas.wallet-socio", () -> "wal_socio_wh");
        r.add("treinos.pagamentos.asaas.conciliacao-ativa", () -> "false");
    }

    @AfterAll
    static void fecharAsaas() {
        ASAAS.close();
    }

    @LocalServerPort private int porta;
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private CifraDePagamento cifra;

    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private String tokenCaminho;
    private String tokenWebhook;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        ASAAS.reiniciar();
        ASAAS.esperaApiKeyMatriz(CHAVE_MATRIZ);
        ASAAS.statusKyc("APPROVED", "APPROVED", null);
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());

        Map<String, Object> payload = payloadSubconta(null);
        api.put(ROTA_CONFIG, admin, payload, 200);

        Map<String, Object> linha = jdbc.queryForMap(
                "select token_caminho, token_webhook_cifrado from subconta_asaas where consultoria_id = ?", consultoria);
        tokenCaminho = (String) linha.get("token_caminho");
        tokenWebhook = cifra.decifrar(consultoria, (String) linha.get("token_webhook_cifrado"));

        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void limparLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    private static Map<String, Object> payloadSubconta(Long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipoPessoa", "PF");
        m.put("documento", "12345678901");
        m.put("nomeTitular", "Treinador Webhook");
        m.put("emailFinanceiro", "webhook@teste.local");
        m.put("telefone", "41999990000");
        m.put("cep", "80010000");
        m.put("enderecoResumo", "Rua XV de Novembro, 100 - Centro");
        m.put("rendaMensalCentavos", 1200000L);
        m.put("bancoCodigo", "341");
        m.put("bancoNome", "Itaú");
        m.put("agencia", "1234");
        m.put("conta", "12345-6");
        m.put("tipoConta", "CORRENTE");
        m.put("repasseAutomatico", true);
        m.put("maxParcelas", 12);
        m.put("jurosParcelamento", "ALUNO");
        if (versao != null) {
            m.put("versao", versao);
        }
        return m;
    }

    private HttpResponse<String> postarWebhook(String caminho, String tokenHeader, String corpo) throws Exception {
        String url = "http://127.0.0.1:" + porta + ROTA_WEBHOOK + caminho;
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(corpo, StandardCharsets.UTF_8));
        if (tokenHeader != null) {
            req.header(AvisoAsaasController.HEADER_TOKEN, tokenHeader);
        }
        return http.send(req.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String eventoJson(String event, String paymentId, String externalRef) {
        return "{\"event\":\"" + event + "\",\"payment\":{\"id\":\"" + paymentId + "\",\"externalReference\":\""
                + externalRef + "\"}}";
    }

    @Test
    void postPublicoSemJwtNemCsrfFuncionaERecusaTokenInvalidoOuDesconhecidoETeto16KiB() throws Exception {
        UUID cobrancaId = UUID.randomUUID();
        String corpo = eventoJson("PAYMENT_RECEIVED", "pay_http_1", cobrancaId.toString());

        // Token de caminho desconhecido -> 404
        assertThat(postarWebhook("Z".repeat(43), tokenWebhook, corpo).statusCode()).isEqualTo(404);
        assertThat(postarWebhook("curto", tokenWebhook, corpo).statusCode()).isEqualTo(404);

        // Sem header asaas-access-token ou token errado -> 401 sem gravar nada
        assertThat(postarWebhook(tokenCaminho, null, corpo).statusCode()).isEqualTo(401);
        assertThat(postarWebhook(tokenCaminho, "token-errado-qualquer", corpo).statusCode()).isEqualTo(401);
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ?",
                Integer.class, consultoria)).isZero();

        // Teto 16 KiB: exatamente 16 KiB passa, 16 KiB + 1 dá 413
        String base = "{\"event\":\"PAYMENT_RECEIVED\",\"payment\":{\"id\":\"pay_lim\",\"externalReference\":\""
                + cobrancaId + "\"},\"extra\":\"";
        String fim = "\"}";
        String limiteExato = base + "a".repeat(16 * 1024 - base.length() - fim.length()) + fim;
        String passou = limiteExato.replace("\"extra\":\"a", "\"extra\":\"aa");
        assertThat(limiteExato.getBytes(StandardCharsets.UTF_8)).hasSize(16 * 1024);

        HttpResponse<String> okLimite = postarWebhook(tokenCaminho, tokenWebhook, limiteExato);
        assertThat(okLimite.statusCode()).isEqualTo(200);
        assertThat(okLimite.body()).isEmpty();
        assertThat(okLimite.headers().firstValue("Cache-Control").orElse("")).contains("no-store");

        HttpResponse<String> excedido = postarWebhook(tokenCaminho, tokenWebhook, passou);
        assertThat(excedido.statusCode()).isEqualTo(413);
        assertThat(json.readTree(excedido.body()).path("codigo").asString()).isEqualTo("CORPO_EXCEDIDO");

        // Nenhum token vazou em log
        for (ILoggingEvent ev : List.copyOf(log.list)) {
            assertThat(ev.getFormattedMessage()).doesNotContain(tokenWebhook).doesNotContain(tokenCaminho);
        }
    }

    @Test
    void rotacaoDeTokenAceitaAnteriorDurante24HorasERecusaDepoisDeExpirar() throws Exception {
        String tokenAnterior = tokenWebhook;
        JsonNode atual = api.get(ROTA_CONFIG, admin, 200);
        Map<String, Object> reqRotacao = payloadSubconta(atual.get("versao").asLong());
        reqRotacao.put("rotacionarWebhook", true);
        api.put(ROTA_CONFIG, admin, reqRotacao, 200);

        String novoTokenCifrado = jdbc.queryForObject(
                "select token_webhook_cifrado from subconta_asaas where consultoria_id = ?", String.class, consultoria);
        String tokenNovo = cifra.decifrar(consultoria, novoTokenCifrado);
        assertThat(tokenNovo).isNotEqualTo(tokenAnterior);

        // Ambos aceitos durante janela de 24h
        assertThat(postarWebhook(tokenCaminho, tokenNovo,
                eventoJson("PAYMENT_RECEIVED", "pay_rot_1", UUID.randomUUID().toString())).statusCode()).isEqualTo(200);
        assertThat(postarWebhook(tokenCaminho, tokenAnterior,
                eventoJson("PAYMENT_RECEIVED", "pay_rot_2", UUID.randomUUID().toString())).statusCode()).isEqualTo(200);
        assertThat(postarWebhook(tokenCaminho, "token-aleatorio-invalido",
                eventoJson("PAYMENT_RECEIVED", "pay_rot_3", UUID.randomUUID().toString())).statusCode()).isEqualTo(401);

        // Expira a janela de 24h -> token anterior passa a dar 401
        jdbc.update("update subconta_asaas set anterior_valido_ate = now() - interval '1 second' where consultoria_id = ?",
                consultoria);
        assertThat(postarWebhook(tokenCaminho, tokenAnterior,
                eventoJson("PAYMENT_RECEIVED", "pay_rot_4", UUID.randomUUID().toString())).statusCode()).isEqualTo(401);
        assertThat(postarWebhook(tokenCaminho, tokenNovo,
                eventoJson("PAYMENT_RECEIVED", "pay_rot_5", UUID.randomUUID().toString())).statusCode()).isEqualTo(200);
    }

    @Test
    void webhookDeCobrancaTestePromoveSubcontaParaAtivaAutomaticamente() throws Exception {
        // Subconta nasce PRONTA_PARA_TESTE (KYC já aprovado no BeforeEach)
        JsonNode antes = api.get(ROTA_CONFIG, admin, 200);
        assertThat(antes.get("situacao").asString()).isEqualTo("PRONTA_PARA_TESTE");

        // Gera cobrança teste de R$ 5,00
        JsonNode teste = api.post(ROTA_CONFIG + "/cobranca-teste", admin, Map.of(), 200);
        String paymentTesteId = teste.get("cobrancaTesteId").asString();
        UUID subcontaId = jdbc.queryForObject("select id from subconta_asaas where consultoria_id = ?",
                UUID.class, consultoria);

        // Marca paga na AsaasFalsa e envia webhook público
        ASAAS.marcarPago(paymentTesteId);
        HttpResponse<String> resp = postarWebhook(tokenCaminho, tokenWebhook,
                eventoJson("PAYMENT_RECEIVED", paymentTesteId, "TESTE:" + subcontaId));
        assertThat(resp.statusCode()).isEqualTo(200);

        // Subconta foi promovida automaticamente para ATIVA com homologadaEm preenchido!
        JsonNode depois = api.get(ROTA_CONFIG, admin, 200);
        assertThat(depois.get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(depois.get("etapas").get("testeHomologado").asBoolean()).isTrue();
        assertThat(depois.get("etapas").get("ativa").asBoolean()).isTrue();
        assertThat(depois.get("homologadaEm").isNull()).isFalse();
        // Cobrança de teste não polui a tabela aviso_de_pagamento
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ?",
                Integer.class, consultoria)).isZero();
        assertThat(ASAAS.violacoes()).isEmpty();
    }
}
