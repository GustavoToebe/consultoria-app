package br.com.treinos.api.pagamentos;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O aviso da Kiwify chega como chega de verdade: um servidor HTTP real (Tomcat, porta aleatória) e um cliente cru, sem cookie,
 * sem {@code Authorization}, sem {@code X-XSRF-TOKEN} e sem {@code Origin}, com {@code ?signature=} na URL. Prova que
 * {@code /publico/**} não pede CSRF nem login, que a assinatura (HMAC-SHA1 do corpo CRU) é exigida e conferida antes de qualquer
 * gravação, que o token do caminho desconhecido dá 404, o teto do corpo 413, e que o corpo e o e-mail do comprador nunca ficam
 * gravados nem vão ao log. Dados fictícios.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class KiwifyWebhookHttpIntegrationTest extends KiwifyDeTeste {

    @LocalServerPort private int porta;

    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
    private Conta conta;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void contaEAppender() throws Exception {
        conta = novaConta();
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOAppender() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    /** POST cru: só o que a Kiwify manda, e o {@code Content-Type} dado (nenhum quando nulo). */
    private HttpResponse<String> postar(String caminho, String consulta, String tipoDoCorpo, String corpo) throws Exception {
        String url = "http://127.0.0.1:" + porta + CAMINHO + caminho + (consulta == null ? "" : "?" + consulta);
        HttpRequest.Builder pedido = HttpRequest.newBuilder(URI.create(url))
                .POST(HttpRequest.BodyPublishers.ofString(corpo, StandardCharsets.UTF_8));
        if (tipoDoCorpo != null) {
            pedido.header("Content-Type", tipoDoCorpo);
        }
        return http.send(pedido.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> avisarAssinado(String corpo) throws Exception {
        return postar(conta.caminho(), "signature=" + assinar(conta.token(), corpo), "application/json", corpo);
    }

    private int gravados() {
        return totalDeAvisos(conta);
    }

    @Test
    void avisoAssinadoComJsonTextoOuSemTipoDeCorpoResponde200EGravaSemCsrfNemLogin() throws Exception {
        for (String tipo : new String[] {"application/json", "text/plain", null}) {
            String pedido = pedido();
            String corpo = corpo(pedido, "order_approved");

            HttpResponse<String> resposta = postar(conta.caminho(), "signature=" + assinar(conta.token(), corpo), tipo, corpo);

            assertThat(resposta.statusCode()).as("Content-Type %s", tipo).isEqualTo(200);
            assertThat(resposta.body()).as("Content-Type %s", tipo).isEmpty();
            assertThat(resposta.headers().firstValue("Cache-Control").orElse("")).contains("no-store");
            assertThat(avisoNoBanco(conta, pedido, "order_approved").get("situacao")).as("Content-Type %s", tipo).isEqualTo("PENDENTE");
        }
    }

    @Test
    void gravaSoIdentificadoresEOHashDoCorpo() throws Exception {
        String pedido = pedido();
        String marcador = "MARCADOR-" + UUID.randomUUID();
        String corpo = corpo(pedido, "subscription_renewed", marcador);

        assertThat(avisarAssinado(corpo).statusCode()).isEqualTo(200);

        Map<String, Object> linha = avisoNoBanco(conta, pedido, "subscription_renewed");
        assertThat(linha.get("referencia")).isEqualTo(pedido);
        assertThat(linha.get("evento_tipo")).isEqualTo("subscription_renewed");
        assertThat(linha.get("assinatura_id").toString()).startsWith("sub-");
        assertThat(linha.get("hash_corpo")).isEqualTo(AvisoInfinitePayService.sha256(corpo.getBytes(StandardCharsets.UTF_8)));
        assertThat(linha.get("situacao")).isEqualTo("PENDENTE");
        assertThat(inteiro(linha, "revisao")).isEqualTo(1);
        assertThat(inteiro(linha, "tentativas")).isZero();
        assertThat(linha.get("slug")).isNull();
        assertThat(linha.get("cobranca_id")).isNull();
        assertThat(linha.get("reservado_por")).isNull();
        // Nada do corpo, do comprador nem do e-mail dele em coluna nenhuma da linha.
        String tudo = jdbc.queryForObject("select a::text from aviso_de_pagamento a where a.consultoria_id = ? and a.referencia = ?",
                String.class, conta.consultoria(), pedido);
        assertThat(tudo).doesNotContain(marcador).doesNotContain("@exemplo.invalid").doesNotContain("Customer")
                .doesNotContain("full_name");
        assertThat(FALSA.requisicoes()).as("o webhook não chama a Kiwify").isEmpty();
    }

    @Test
    void semAssinaturaOuComAssinaturaErradaDa401SemGravarNada() throws Exception {
        String corpo = corpo(pedido(), "order_approved");
        String certa = assinar(conta.token(), corpo);
        String deOutroToken = assinar("outro-token-ficticio-qualquer", corpo);
        String adulterado = corpo.replace("paid", "pad!");
        String reordenado = "{ " + corpo.substring(1);

        List<HttpResponse<String>> recusadas = List.of(
                postar(conta.caminho(), null, "application/json", corpo),
                postar(conta.caminho(), "signature=", "application/json", corpo),
                postar(conta.caminho(), "outro=1", "application/json", corpo),
                postar(conta.caminho(), "signature=" + deOutroToken, "application/json", corpo),
                postar(conta.caminho(), "signature=" + certa.toUpperCase(java.util.Locale.ROOT), "application/json", corpo),
                postar(conta.caminho(), "signature=" + certa.substring(1), "application/json", corpo),
                postar(conta.caminho(), "signature=" + certa + "0", "application/json", corpo),
                postar(conta.caminho(), "signature=" + certa + "&signature=" + certa, "application/json", corpo),
                postar(conta.caminho(), "signature=" + certa, "application/json", adulterado),
                // Corpo reserializado (outro espaçamento): a assinatura vale só sobre os bytes que chegaram.
                postar(conta.caminho(), "signature=" + certa, "application/json", reordenado),
                postar(conta.caminho(), "signature=" + "z".repeat(40), "application/json", corpo));

        for (HttpResponse<String> r : recusadas) {
            assertThat(r.statusCode()).isEqualTo(401);
            assertThat(r.body()).doesNotContain(conta.token()).doesNotContain(certa);
        }
        assertThat(gravados()).isZero();
        // A certa passa: o único erro acima era a assinatura.
        assertThat(postar(conta.caminho(), "signature=" + certa, "application/json", corpo).statusCode()).isEqualTo(200);
        assertThat(gravados()).isEqualTo(1);
    }

    @Test
    void oCorpoCruEOQueValeMesmoComContentTypeDeFormulario() throws Exception {
        // O corpo é lido em bytes, sem o servidor o interpretar como parâmetros: a assinatura vale sobre o que chegou.
        String pedido = pedido();
        String corpo = corpo(pedido, "order_approved");

        HttpResponse<String> certa = postar(conta.caminho(), "signature=" + assinar(conta.token(), corpo),
                "application/x-www-form-urlencoded", corpo);
        HttpResponse<String> errada = postar(conta.caminho(), "signature=" + "0".repeat(40),
                "application/x-www-form-urlencoded", corpo);

        assertThat(certa.statusCode()).isEqualTo(200);
        assertThat(errada.statusCode()).isEqualTo(401);
        assertThat(avisoNoBanco(conta, pedido, "order_approved").get("situacao")).isEqualTo("PENDENTE");
        assertThat(gravados()).isEqualTo(1);
    }

    @Test
    void tokenDoCaminhoDesconhecidoOuMalformadoDa404MesmoComAssinaturaECSemCsrf() throws Exception {
        String corpo = corpo(pedido(), "order_approved");
        String assinatura = assinar(conta.token(), corpo);

        assertThat(postar("Z".repeat(43), "signature=" + assinatura, "application/json", corpo).statusCode()).isEqualTo(404);
        assertThat(postar("curto", "signature=" + assinatura, "application/json", corpo).statusCode()).isEqualTo(404);
        assertThat(postar("a".repeat(65), "signature=" + assinatura, "application/json", corpo).statusCode()).isEqualTo(404);
        // Token de outra consultoria: 404 do token (nunca 401, que confirmaria que o caminho existe sem a assinatura certa).
        assertThat(gravados()).isZero();
    }

    /** O java.net.URI recusa % torto: a query crua entra pelo MockMvc, que a entrega como veio ao controller. */
    private int statusComQueryCrua(String caminho, String query, String corpo) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(CAMINHO + caminho)
                .contentType("application/json").content(corpo).with(requisicao -> {
                    requisicao.setQueryString(query);
                    return requisicao;
                })).andReturn().getResponse().getStatus();
    }

    @Test
    void percentTortoNaQueryNaoDa500MantendoA404ADepoisA401() throws Exception {
        String corpo = corpo(pedido(), "order_approved");

        // Token desconhecido: 404 antes de olhar a assinatura, com % solto ou %zz.
        assertThat(statusComQueryCrua("Z".repeat(43), "x=%", corpo)).isEqualTo(404);
        assertThat(statusComQueryCrua("Z".repeat(43), "signature=%zz", corpo)).isEqualTo(404);
        // Token válido: assinatura torta vale como ausente (401); par de outro nome torto não atrapalha a certa.
        assertThat(statusComQueryCrua(conta.caminho(), "signature=%zz", corpo)).isEqualTo(401);
        assertThat(statusComQueryCrua(conta.caminho(), "x=%", corpo)).isEqualTo(401);
        assertThat(gravados()).isZero();
        assertThat(statusComQueryCrua(conta.caminho(), "x=%zz&signature=" + assinar(conta.token(), corpo), corpo)).isEqualTo(200);
        assertThat(gravados()).isEqualTo(1);
    }

    @Test
    void orderIdAte78CaracteresGravaEMaiorQueIssoDa400SemEstourarAColuna() throws Exception {
        // order_id + ":" + evento tem de caber em varchar(100): com o evento mais longo, 78 é o teto.
        String noLimite = "x".repeat(78);
        String longo = "x".repeat(79);

        assertThat(avisarAssinado(corpo(noLimite, "subscription_canceled")).statusCode()).isEqualTo(200);
        assertThat(avisoNoBanco(conta, noLimite, "subscription_canceled").get("situacao")).isEqualTo("PENDENTE");
        assertThat(avisarAssinado(corpo(longo, "subscription_canceled")).statusCode()).isEqualTo(400);
        assertThat(gravados()).isEqualTo(1);
    }

    @Test
    void tokenDoCaminhoDeOutraConsultoriaNaoGravaNaDestaNemNaOutra() throws Exception {
        Conta outra = novaConta();
        String corpo = corpo(pedido(), "order_approved");

        // Assinado com o token desta conta, no caminho da outra: a assinatura é da outra consultoria, então 401, nada gravado.
        HttpResponse<String> r = postar(outra.caminho(), "signature=" + assinar(conta.token(), corpo), "application/json", corpo);

        assertThat(r.statusCode()).isEqualTo(401);
        assertThat(gravados()).isZero();
        assertThat(totalDeAvisos(outra)).isZero();
    }

    @Test
    void corpoAcimaDe16KiBDa413EOLimiteExatoPassa() throws Exception {
        String base = "{\"order_id\":\"" + pedido() + "\",\"webhook_event_type\":\"order_approved\",\"x\":\"";
        String fim = "\"}";
        String noLimite = base + "a".repeat(16 * 1024 - base.length() - fim.length()) + fim;
        String passou = noLimite.replace("\"x\":\"a", "\"x\":\"aa");

        assertThat(noLimite.getBytes(StandardCharsets.UTF_8)).hasSize(16 * 1024);
        assertThat(avisarAssinado(noLimite).statusCode()).isEqualTo(200);
        HttpResponse<String> grande = avisarAssinado(passou);
        assertThat(grande.statusCode()).isEqualTo(413);
        assertThat(json.readTree(grande.body()).path("codigo").asString()).isEqualTo("CORPO_EXCEDIDO");
        // Sem assinatura nem o teto é tratado antes (413 vem antes de qualquer outra conferência).
        assertThat(postar(conta.caminho(), null, "application/json", passou).statusCode()).isEqualTo(413);
        assertThat(gravados()).isEqualTo(1);
    }

    @Test
    void avisoMalformadoDa400EOQueNaoInteressaResponde200SemGravar() throws Exception {
        String semPedido = "{\"order_status\":\"paid\",\"webhook_event_type\":\"order_approved\"}";
        String pedidoNulo = "{\"order_id\":null,\"webhook_event_type\":\"order_approved\"}";

        // Sem order_id (ausente ou nulo): 200, nada a consultar.
        assertThat(avisarAssinado(semPedido).statusCode()).isEqualTo(200);
        assertThat(avisarAssinado(pedidoNulo).statusCode()).isEqualTo(200);
        // Eventos que a conciliação não trata (recusada, Pix gerado, atraso, sem evento): 200 sem gravar.
        for (String evento : List.of("order_rejected", "pix_created", "billet_created", "subscription_late", "xyz")) {
            assertThat(avisarAssinado(corpo(pedido(), evento)).statusCode()).as(evento).isEqualTo(200);
        }
        assertThat(avisarAssinado("{\"order_id\":\"" + pedido() + "\"}").statusCode()).isEqualTo(200);
        assertThat(gravados()).isZero();

        // Malformado (assinado, para chegar até a leitura): 400 AVISO_INVALIDO com mensagem fixa, sem gravar.
        for (String torto : List.of("não é json", "[]", "\"texto\"", "", "{\"order_id\":123,\"webhook_event_type\":\"order_approved\"}",
                "{\"order_id\":\"tem espaço\",\"webhook_event_type\":\"order_approved\"}",
                "{\"order_id\":\"" + "x".repeat(79) + "\",\"webhook_event_type\":\"order_approved\"}")) {
            HttpResponse<String> r = avisarAssinado(torto);
            assertThat(r.statusCode()).as(torto).isEqualTo(400);
            JsonNode erro = json.readTree(r.body());
            assertThat(erro.path("codigo").asString()).isEqualTo("AVISO_INVALIDO");
            assertThat(r.body()).doesNotContain("espaço");
        }
        assertThat(gravados()).isZero();
    }

    @Test
    void repetirOMesmoAvisoNaoDuplicaEEventosDiferentesDoMesmoPedidoSaoLinhasDiferentes() throws Exception {
        String pedido = pedido();

        for (int i = 0; i < 3; i++) {
            assertThat(avisarAssinado(corpo(pedido, "order_approved")).statusCode()).isEqualTo(200);
        }
        assertThat(gravados()).isEqualTo(1);
        assertThat(inteiro(avisoNoBanco(conta, pedido, "order_approved"), "revisao")).isEqualTo(3);
        assertThat(avisarAssinado(corpo(pedido, "subscription_renewed")).statusCode()).isEqualTo(200);
        assertThat(avisarAssinado(corpo(pedido, "order_refunded")).statusCode()).isEqualTo(200);
        assertThat(gravados()).isEqualTo(3);
        // Um pedido diferente com o mesmo evento é outra linha.
        assertThat(avisarAssinado(corpo(pedido(), "order_approved")).statusCode()).isEqualTo(200);
        assertThat(gravados()).isEqualTo(4);
    }

    @Test
    void oTokenAnteriorDoWebhookValeEnquantoEntregueEDepoisNao() throws Exception {
        String anterior = conta.token();
        String novo = "token-novo-do-webhook-" + UUID.randomUUID();
        api.put("/financeiro/kiwify", conta.login(), Map.of("tokenDoWebhook", novo, "versao", 0L), 200);
        String corpo = corpo(pedido(), "order_approved");

        // O novo vale na hora, o anterior também (reenvios de antes da troca); outro token qualquer não.
        assertThat(postar(conta.caminho(), "signature=" + assinar(novo, corpo), "application/json", corpo).statusCode()).isEqualTo(200);
        String corpo2 = corpo(pedido(), "order_approved");
        assertThat(postar(conta.caminho(), "signature=" + assinar(anterior, corpo2), "application/json", corpo2).statusCode())
                .isEqualTo(200);
        String corpo3 = corpo(pedido(), "order_approved");
        assertThat(postar(conta.caminho(), "signature=" + assinar("token-qualquer-que-nao-e-nenhum", corpo3), "application/json", corpo3)
                .statusCode()).isEqualTo(401);

        // Passadas as 24 h o anterior deixa de valer.
        jdbc.update("update credencial_kiwify set anterior_valido_ate = now() - interval '1 second' where consultoria_id = ?",
                conta.consultoria());
        String corpo4 = corpo(pedido(), "order_approved");
        assertThat(postar(conta.caminho(), "signature=" + assinar(anterior, corpo4), "application/json", corpo4).statusCode())
                .isEqualTo(401);
        assertThat(postar(conta.caminho(), "signature=" + assinar(novo, corpo4), "application/json", corpo4).statusCode()).isEqualTo(200);
        assertThat(gravados()).isEqualTo(3);
    }

    @Test
    void nadaDoAvisoVaiAoLog() throws Exception {
        String marcador = "MARCADOR-" + UUID.randomUUID();
        String corpo = corpo(pedido(), "order_approved", marcador);
        String assinatura = assinar(conta.token(), corpo);

        avisarAssinado(corpo);
        postar(conta.caminho(), "signature=" + "0".repeat(40), "application/json", corpo);
        postar("Z".repeat(43), "signature=" + assinatura, "application/json", corpo);

        for (ILoggingEvent evento : List.copyOf(log.list)) {
            String texto = evento.getFormattedMessage()
                    + (evento.getThrowableProxy() == null ? "" : evento.getThrowableProxy().getMessage());
            for (String proibido : new String[] {conta.token(), conta.caminho(), assinatura, marcador, "@exemplo.invalid"}) {
                assertThat(texto).as("log: " + evento.getLoggerName()).doesNotContain(proibido);
            }
        }
    }
}
