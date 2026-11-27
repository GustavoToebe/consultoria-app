package br.com.treinos.api.pagamentos;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Servidor Asaas v3 falso em {@code 127.0.0.1:0} para testes unitários e de integração.
 * Valida regras reais da API (cabeçalho {@code access_token}, piso de R$ 5,00 em cobranças, proibição de split para a
 * própria carteira da subconta emissora e campos de webhook; qualquer dado de cartão no corpo é violação) e acumula qualquer violação em {@link #violacoes()}.
 */
public final class AsaasFalsa implements AutoCloseable {

    public record Requisicao(String caminho, String metodo, String accessToken, JsonNode corpo) {
    }

    private static final class PagamentoFake {
        final String id;
        volatile String billingType;
        volatile BigDecimal value;
        volatile BigDecimal netValue;
        final String externalReference;
        final Integer installmentCount;
        volatile String status;
        volatile LocalDate confirmedDate;

        PagamentoFake(String id, String billingType, BigDecimal value, String externalReference,
                      Integer installmentCount, String status) {
            this.id = id;
            this.billingType = billingType;
            this.value = value;
            this.netValue = value.subtract(new BigDecimal("0.99")).max(BigDecimal.ZERO);
            this.externalReference = externalReference;
            this.installmentCount = installmentCount;
            this.status = status;
        }
    }

    private final JsonMapper json = new JsonMapper();
    private final HttpServer servidor;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "asaas-falsa");
        t.setDaemon(true);
        return t;
    });

    private final List<Requisicao> requisicoes = new CopyOnWriteArrayList<>();
    private final List<String> violacoes = new CopyOnWriteArrayList<>();
    private final Map<String, String> walletPorApiKey = new ConcurrentHashMap<>();
    private final Map<String, PagamentoFake> pagamentos = new ConcurrentHashMap<>();
    private final AtomicInteger seqConta = new AtomicInteger();
    private final AtomicInteger seqCliente = new AtomicInteger();
    private final AtomicInteger seqPagamento = new AtomicInteger();
    private final AtomicBoolean fechada = new AtomicBoolean();

    private volatile String apiKeyMatrizEsperada;
    private volatile String statusGeneral = "PENDING";
    private volatile String statusDocumentation = "PENDING";
    private volatile String onboardingUrl = "https://sandbox.asaas.com/onboarding/doc-teste";
    private volatile String hostDaFatura = "sandbox.asaas.com";
    private final AtomicInteger exclusoesQueFalham = new AtomicInteger();
    private volatile java.util.function.Consumer<String> aoCriarPagamento;

    public AsaasFalsa() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException("Não subiu a Asaas falsa.", e);
        }
        servidor.createContext("/", this::tratar);
        servidor.setExecutor(executor);
        servidor.start();
    }

    public String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    public void reiniciar() {
        requisicoes.clear();
        violacoes.clear();
        walletPorApiKey.clear();
        pagamentos.clear();
        seqConta.set(0);
        seqCliente.set(0);
        seqPagamento.set(0);
        apiKeyMatrizEsperada = null;
        statusGeneral = "PENDING";
        statusDocumentation = "PENDING";
        onboardingUrl = "https://sandbox.asaas.com/onboarding/doc-teste";
        hostDaFatura = "sandbox.asaas.com";
        exclusoesQueFalham.set(0);
        aoCriarPagamento = null;
    }

    /** Host da invoiceUrl devolvida (padrão: o do sandbox); serve para provar que a API recusa host de fora do Asaas. */
    public AsaasFalsa hostDaFatura(String host) {
        this.hostDaFatura = host;
        return this;
    }

    /** As próximas {@code n} exclusões ({@code DELETE /payments/{id}}) respondem 503, como um Asaas fora do ar. */
    public AsaasFalsa falharProximasExclusoes(int n) {
        exclusoesQueFalham.set(n);
        return this;
    }

    /**
     * Gancho chamado uma vez, com a {@code externalReference}, no meio do próximo {@code POST /payments} (já validado, antes de
     * criar): é a "outra aba" que grava a cobrança dela primeiro.
     */
    public AsaasFalsa aoCriarPagamento(java.util.function.Consumer<String> gancho) {
        this.aoCriarPagamento = gancho;
        return this;
    }

    public String statusDoPagamento(String paymentId) {
        PagamentoFake p = pagamentos.get(paymentId);
        return p == null ? null : p.status;
    }

    public AsaasFalsa esperaApiKeyMatriz(String apiKeyMatriz) {
        this.apiKeyMatrizEsperada = apiKeyMatriz;
        return this;
    }

    public AsaasFalsa statusKyc(String general, String documentation, String onboardingUrl) {
        this.statusGeneral = general;
        this.statusDocumentation = documentation;
        this.onboardingUrl = onboardingUrl;
        return this;
    }

    public AsaasFalsa registrarSubconta(String apiKey, String walletId) {
        walletPorApiKey.put(apiKey, walletId);
        return this;
    }

    /** Pago pela página da fatura: o Asaas troca o UNDEFINED pelo meio usado (Pix, aqui). */
    public void marcarPago(String paymentId) {
        marcarPagoCom(paymentId, "PIX");
    }

    public void marcarPagoNoCartao(String paymentId) {
        marcarPagoCom(paymentId, "CREDIT_CARD");
    }

    /** Pago por boleto na página da fatura (UNDEFINED): o Asaas troca o tipo para BOLETO. */
    public void marcarPagoNoBoleto(String paymentId) {
        marcarPagoCom(paymentId, "BOLETO");
    }

    private void marcarPagoCom(String paymentId, String meio) {
        marcarStatus(paymentId, "RECEIVED");
        pagamentos.get(paymentId).billingType = meio;
    }

    public void marcarStatus(String paymentId, String novoStatus) {
        PagamentoFake p = pagamentos.get(paymentId);
        if (p == null) {
            throw new IllegalArgumentException("Pagamento não encontrado na AsaasFalsa: " + paymentId);
        }
        p.status = novoStatus;
        if ("RECEIVED".equals(novoStatus) || "CONFIRMED".equals(novoStatus)) {
            p.confirmedDate = LocalDate.now(ZoneOffset.UTC);
        }
    }

    public void alterarValor(String paymentId, BigDecimal novoValor) {
        PagamentoFake p = pagamentos.get(paymentId);
        if (p == null) {
            throw new IllegalArgumentException("Pagamento não encontrado na AsaasFalsa: " + paymentId);
        }
        p.value = novoValor;
        p.netValue = novoValor.subtract(new BigDecimal("0.99")).max(BigDecimal.ZERO);
    }

    public String criarPagamentoPreExistente(String billingType, BigDecimal value, String externalReference, String status) {
        String id = "pay_fake_" + seqPagamento.incrementAndGet();
        PagamentoFake p = new PagamentoFake(id, billingType, value, externalReference, 1, status);
        if ("RECEIVED".equals(status) || "CONFIRMED".equals(status)) {
            p.confirmedDate = LocalDate.now(ZoneOffset.UTC);
        }
        pagamentos.put(id, p);
        return id;
    }

    public List<Requisicao> requisicoes() {
        return List.copyOf(requisicoes);
    }

    public List<Requisicao> requisicoes(String caminho) {
        return requisicoes.stream().filter(r -> r.caminho().equals(caminho)).toList();
    }

    public List<String> violacoes() {
        return List.copyOf(violacoes);
    }

    @Override
    public void close() {
        if (fechada.compareAndSet(false, true)) {
            servidor.stop(0);
            executor.shutdownNow();
        }
    }

    // ---- roteamento ----

    private void tratar(HttpExchange troca) throws IOException {
        try (troca) {
            String caminho = troca.getRequestURI().getPath();
            String metodo = troca.getRequestMethod();
            String accessToken = troca.getRequestHeaders().getFirst("access_token");
            byte[] bytes = troca.getRequestBody().readNBytes(1024 * 1024);
            JsonNode corpo = null;
            List<String> problemas = new ArrayList<>();
            if (bytes.length > 0) {
                try {
                    corpo = json.readTree(bytes);
                } catch (RuntimeException e) {
                    problemas.add("corpo não é JSON válido");
                }
            }
            requisicoes.add(new Requisicao(caminho, metodo, accessToken, corpo));

            if (accessToken == null || accessToken.isBlank()) {
                problemas.add("faltou cabeçalho access_token");
            }
            if (!problemas.isEmpty()) {
                falhar(troca, caminho, problemas);
                return;
            }

            if ("POST".equals(metodo) && "/accounts".equals(caminho)) {
                tratarCriarSubconta(troca, accessToken, corpo, problemas);
            } else if ("GET".equals(metodo) && "/myAccount/status".equals(caminho)) {
                tratarStatus(troca);
            } else if ("GET".equals(metodo) && "/myAccount/documents".equals(caminho)) {
                tratarDocumentos(troca);
            } else if ("POST".equals(metodo) && "/webhooks".equals(caminho)) {
                tratarWebhook(troca, corpo, problemas);
            } else if ("POST".equals(metodo) && "/customers".equals(caminho)) {
                tratarCriarCliente(troca, corpo, problemas);
            } else if ("POST".equals(metodo) && "/payments".equals(caminho)) {
                tratarCriarPagamento(troca, accessToken, corpo, problemas);
            } else if ("GET".equals(metodo) && caminho.startsWith("/payments/") && caminho.endsWith("/pixQrCode")) {
                String id = caminho.substring("/payments/".length(), caminho.length() - "/pixQrCode".length());
                tratarQrCode(troca, id);
            } else if ("DELETE".equals(metodo) && caminho.startsWith("/payments/")) {
                tratarExcluirPagamento(troca, caminho.substring("/payments/".length()));
            } else if ("GET".equals(metodo) && caminho.startsWith("/payments/")) {
                String id = caminho.substring("/payments/".length());
                tratarConsultarPagamento(troca, id);
            } else {
                problemas.add("rota inesperada: " + metodo + " " + caminho);
                falhar(troca, caminho, problemas);
            }
        } catch (IOException | RuntimeException e) {
            if (!(e instanceof IOException)) {
                violacoes.add("erro interno na AsaasFalsa: " + e.getClass().getSimpleName());
            }
        }
    }

    private void tratarCriarSubconta(HttpExchange troca, String accessToken, JsonNode corpo, List<String> problemas)
            throws IOException {
        if (apiKeyMatrizEsperada != null && !apiKeyMatrizEsperada.equals(accessToken)) {
            problemas.add("POST /accounts não usou apiKey da matriz");
        }
        if (corpo == null || !corpo.isObject()) {
            problemas.add("corpo ausente em POST /accounts");
        } else {
            exigirTexto(corpo, "name", problemas);
            exigirTexto(corpo, "email", problemas);
            exigirTexto(corpo, "cpfCnpj", problemas);
        }
        if (!problemas.isEmpty()) {
            falhar(troca, "/accounts", problemas);
            return;
        }
        int n = seqConta.incrementAndGet();
        String contaId = "acc_fake_" + n;
        String walletId = "wal_fake_" + n;
        String apiKey = "$aact_fake_subconta_" + n + "_segredo";
        walletPorApiKey.put(apiKey, walletId);

        ObjectNode resp = json.createObjectNode();
        resp.put("id", contaId);
        resp.put("walletId", walletId);
        resp.put("apiKey", apiKey);
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void tratarStatus(HttpExchange troca) throws IOException {
        ObjectNode resp = json.createObjectNode();
        resp.put("general", statusGeneral);
        resp.put("commercialInfo", statusGeneral);
        resp.put("bankAccountInfo", statusGeneral);
        resp.put("documentation", statusDocumentation);
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void tratarDocumentos(HttpExchange troca) throws IOException {
        ObjectNode resp = json.createObjectNode();
        ArrayNode data = resp.putArray("data");
        ObjectNode doc = data.addObject();
        doc.put("id", "doc_fake_1");
        doc.put("status", statusDocumentation);
        if (onboardingUrl != null) {
            doc.put("onboardingUrl", onboardingUrl);
        }
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void tratarWebhook(HttpExchange troca, JsonNode corpo, List<String> problemas) throws IOException {
        if (corpo == null || !corpo.isObject()) {
            problemas.add("corpo ausente em POST /webhooks");
        } else {
            String url = corpo.path("url").asString("");
            if (!url.startsWith("https://")) {
                problemas.add("webhook.url não é https");
            }
            exigirTexto(corpo, "authToken", problemas);
            if (!corpo.path("events").isArray() || corpo.path("events").isEmpty()) {
                problemas.add("webhook.events vazio");
            }
        }
        if (!problemas.isEmpty()) {
            falhar(troca, "/webhooks", problemas);
            return;
        }
        ObjectNode resp = json.createObjectNode();
        resp.put("id", "wh_fake_1");
        resp.put("enabled", true);
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void tratarCriarCliente(HttpExchange troca, JsonNode corpo, List<String> problemas) throws IOException {
        if (corpo == null || !corpo.isObject()) {
            problemas.add("corpo ausente em POST /customers");
        } else {
            exigirTexto(corpo, "name", problemas);
            exigirTexto(corpo, "cpfCnpj", problemas);
        }
        if (!problemas.isEmpty()) {
            falhar(troca, "/customers", problemas);
            return;
        }
        ObjectNode resp = json.createObjectNode();
        resp.put("id", "cus_fake_" + seqCliente.incrementAndGet());
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void tratarCriarPagamento(HttpExchange troca, String accessToken, JsonNode corpo, List<String> problemas)
            throws IOException {
        if (corpo == null || !corpo.isObject()) {
            problemas.add("corpo ausente em POST /payments");
            falhar(troca, "/payments", problemas);
            return;
        }
        String billingType = corpo.path("billingType").asString("");
        if (!"PIX".equals(billingType) && !"UNDEFINED".equals(billingType)) {
            problemas.add("billingType inválido: " + billingType);
        }
        if (corpo.has("creditCard") || corpo.has("creditCardHolderInfo") || corpo.has("remoteIp")) {
            problemas.add("dado de cartão enviado ao Asaas");
        }
        exigirTexto(corpo, "customer", problemas);
        exigirTexto(corpo, "dueDate", problemas);
        JsonNode valueNode = corpo.path("value");
        BigDecimal value = valueNode.isNumber() ? valueNode.decimalValue() : null;
        if (value == null || value.compareTo(new BigDecimal("5.00")) < 0) {
            problemas.add("value abaixo do piso de R$ 5,00");
        }
        String walletSubconta = walletPorApiKey.get(accessToken);
        JsonNode split = corpo.path("split");
        if (split.isArray()) {
            for (JsonNode item : split) {
                String w = item.path("walletId").asString("");
                if (w.isBlank()) {
                    problemas.add("split com walletId vazio");
                } else if (walletSubconta != null && walletSubconta.equals(w)) {
                    problemas.add("split incluiu walletId da própria subconta emissora");
                }
            }
        }
        if (!problemas.isEmpty()) {
            falhar(troca, "/payments", problemas);
            return;
        }
        java.util.function.Consumer<String> gancho = aoCriarPagamento;
        if (gancho != null) {
            aoCriarPagamento = null;
            gancho.accept(corpo.path("externalReference").isString() ? corpo.path("externalReference").asString() : null);
        }
        String id = "pay_fake_" + seqPagamento.incrementAndGet();
        String extRef = corpo.path("externalReference").isString() ? corpo.path("externalReference").asString() : null;
        Integer parcelas = corpo.path("installmentCount").isIntegralNumber()
                ? corpo.path("installmentCount").intValue() : 1;
        PagamentoFake p = new PagamentoFake(id, billingType, value, extRef, parcelas, "PENDING");
        pagamentos.put(id, p);

        ObjectNode resp = json.createObjectNode();
        resp.put("id", p.id);
        resp.put("status", p.status);
        resp.put("billingType", p.billingType);
        resp.put("value", p.value);
        resp.put("netValue", p.netValue);
        resp.put("invoiceUrl", "https://" + hostDaFatura + "/i/" + p.id);
        if (extRef != null) {
            resp.put("externalReference", extRef);
        }
        responder(troca, 200, json.writeValueAsString(resp));
    }

    /** Cobrança paga não se apaga (400); inexistente dá 404; senão vira DELETED. */
    private void tratarExcluirPagamento(HttpExchange troca, String id) throws IOException {
        if (exclusoesQueFalham.getAndUpdate(n -> Math.max(0, n - 1)) > 0) {
            responder(troca, 503, "{\"errors\":[{\"description\":\"indisponivel\"}]}");
            return;
        }
        PagamentoFake p = pagamentos.get(id);
        if (p == null) {
            responder(troca, 404, "{\"errors\":[{\"description\":\"not found\"}]}");
            return;
        }
        if ("RECEIVED".equals(p.status) || "CONFIRMED".equals(p.status) || "RECEIVED_IN_CASH".equals(p.status)) {
            responder(troca, 400, "{\"errors\":[{\"description\":\"cobranca recebida\"}]}");
            return;
        }
        p.status = "DELETED";
        responder(troca, 200, json.writeValueAsString(json.createObjectNode().put("deleted", true).put("id", id)));
    }

    private void tratarQrCode(HttpExchange troca, String id) throws IOException {
        if (!pagamentos.containsKey(id)) {
            responder(troca, 404, "{\"errors\":[{\"description\":\"not found\"}]}");
            return;
        }
        ObjectNode resp = json.createObjectNode();
        resp.put("encodedImage", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        resp.put("payload", "00020126580014br.gov.bcb.pix0136asaas-fake-" + id + "5204000053039865802BR5915OVERTRAINING6009CURITIBA62070503***6304ABCD");
        resp.put("expirationDate", Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS).toString());
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void tratarConsultarPagamento(HttpExchange troca, String id) throws IOException {
        PagamentoFake p = pagamentos.get(id);
        if (p == null) {
            responder(troca, 404, "{\"errors\":[{\"description\":\"not found\"}]}");
            return;
        }
        ObjectNode resp = json.createObjectNode();
        resp.put("id", p.id);
        resp.put("status", p.status);
        resp.put("billingType", p.billingType);
        resp.put("value", p.value);
        resp.put("netValue", p.netValue);
        resp.put("invoiceUrl", "https://" + hostDaFatura + "/i/" + p.id);
        if (p.externalReference != null) {
            resp.put("externalReference", p.externalReference);
        }
        if (p.confirmedDate != null) {
            resp.put("confirmedDate", p.confirmedDate.toString());
            resp.put("paymentDate", p.confirmedDate.toString());
        }
        if (p.installmentCount != null) {
            resp.put("installmentCount", p.installmentCount);
        }
        responder(troca, 200, json.writeValueAsString(resp));
    }

    private void exigirTexto(JsonNode corpo, String campo, List<String> problemas) {
        JsonNode no = corpo.path(campo);
        if (!no.isString() || no.asString().isBlank()) {
            problemas.add("campo obrigatório ausente: " + campo.toLowerCase(Locale.ROOT));
        }
    }

    private void falhar(HttpExchange troca, String caminho, List<String> problemas) throws IOException {
        String motivo = String.join("; ", problemas);
        violacoes.add(caminho + ": " + motivo);
        responder(troca, 400, json.writeValueAsString(json.createObjectNode().put("erro", motivo)));
    }

    private static void responder(HttpExchange troca, int status, String corpo) throws IOException {
        byte[] bytes = corpo.getBytes(StandardCharsets.UTF_8);
        troca.getResponseHeaders().set("Content-Type", "application/json");
        troca.sendResponseHeaders(status, bytes.length);
        try (OutputStream saida = troca.getResponseBody()) {
            saida.write(bytes);
        }
    }
}
