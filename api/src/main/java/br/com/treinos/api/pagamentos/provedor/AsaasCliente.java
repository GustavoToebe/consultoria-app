package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.AsaasProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

/**
 * Cliente HTTP da API v3 do Asaas. Tempo limite de conexão (5 s) e resposta (15 s), sem redirecionamento e leitura máxima
 * de 256 KiB. Nunca executa dentro de transação ativa e nunca registra segredos, PAN, CVV, CPF/CNPJ, API keys ou corpos de
 * erro em log nem em exceção. Qualquer falha HTTP, rede, tamanho ou JSON vira {@link ProvedorIndisponivelException}.
 */
@Component
public class AsaasCliente {

    public static final long VALOR_MINIMO_CENTAVOS = 500L;

    private static final Logger log = LoggerFactory.getLogger(AsaasCliente.class);
    private static final Duration CONEXAO = Duration.ofSeconds(5);
    private static final Duration RESPOSTA = Duration.ofSeconds(15);
    private static final int MAXIMO_BYTES = 256 * 1024;
    private static final DateTimeFormatter EXPIRACAO_ASAAS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public record DadosCriacaoSubconta(String nome, String email, String cpfCnpj, String telefone,
                                       Long rendaMensalCentavos, String cep, String endereco, String numeroEndereco,
                                       String bairro, String tipoEmpresa, LocalDate dataNascimento) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record SubcontaCriada(String contaId, String walletId, String apiKey) {
        @Override
        public String toString() {
            return "SubcontaCriada[contaId=" + contaId + "]";
        }
    }

    public record StatusContaAsaas(String general, String commercialInfo, String bankAccountInfo,
                                   String documentation, String onboardingUrl) {
        public boolean aprovada() {
            return "APPROVED".equalsIgnoreCase(general)
                    || ("APPROVED".equalsIgnoreCase(documentation) && !"REJECTED".equalsIgnoreCase(general));
        }

        public boolean rejeitada() {
            return "REJECTED".equalsIgnoreCase(general) || "REJECTED".equalsIgnoreCase(documentation);
        }

        @Override
        public String toString() {
            return "StatusContaAsaas[general=" + general + ", documentation=" + documentation + "]";
        }
    }

    public record SplitAsaas(String walletId, Long fixedValueCentavos, BigDecimal percentualValue) {
    }

    public record PedidoPixAsaas(String customerId, long valorCentavos, LocalDate vencimento, String descricao,
                                 String referenciaExterna, String walletIdSubconta, List<SplitAsaas> splits) {
        @Override
        public String toString() {
            return "PedidoPixAsaas[referenciaExterna=" + referenciaExterna + ", valorCentavos=" + valorCentavos + "]";
        }
    }

    public record CobrancaPixCriada(String paymentId, String status, String invoiceUrl, String qrCodeBase64,
                                    String pixCopiaECola, Instant expiraEm) {
        @Override
        public String toString() {
            return "CobrancaPixCriada[paymentId=" + paymentId + ", status=" + status + "]";
        }
    }

    public record DadosCartao(String holderName, String number, String expiryMonth, String expiryYear, String ccv) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record TitularCartao(String name, String email, String cpfCnpj, String postalCode,
                                String addressNumber, String phone) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record PedidoCartaoAsaas(String customerId, long valorCentavos, LocalDate vencimento, String descricao,
                                    String referenciaExterna, int parcelas, DadosCartao cartao,
                                    TitularCartao titular, String remoteIp, String walletIdSubconta,
                                    List<SplitAsaas> splits) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record CobrancaCartaoCriada(String paymentId, String status, String invoiceUrl, Long valorLiquidoCentavos) {
        @Override
        public String toString() {
            return "CobrancaCartaoCriada[paymentId=" + paymentId + ", status=" + status + "]";
        }
    }

    public record CobrancaConsultadaAsaas(String id, String status, String billingType, Long valorCentavos,
                                          Long valorLiquidoCentavos, String externalReference, LocalDate pagoEm,
                                          Integer parcelas) {
        @Override
        public String toString() {
            return "CobrancaConsultadaAsaas[id=" + id + ", status=" + status + "]";
        }
    }

    private final String base;
    private final String apiKeyMatriz;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(CONEXAO)
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = new JsonMapper();

    public AsaasCliente(AsaasProperties propriedades) {
        this.base = propriedades.urlBase();
        this.apiKeyMatriz = propriedades.apiKeyMatriz();
    }

    public SubcontaCriada criarSubconta(DadosCriacaoSubconta dados) {
        exigirForaDeTransacao();
        ObjectNode corpo = json.createObjectNode();
        corpo.put("name", dados.nome());
        corpo.put("email", dados.email());
        corpo.put("cpfCnpj", dados.cpfCnpj());
        if (dados.telefone() != null && !dados.telefone().isBlank()) {
            corpo.put("mobilePhone", dados.telefone());
        }
        if (dados.rendaMensalCentavos() != null && dados.rendaMensalCentavos() > 0) {
            corpo.put("incomeValue", reais(dados.rendaMensalCentavos()));
        }
        if (dados.endereco() != null && !dados.endereco().isBlank()) {
            corpo.put("address", dados.endereco());
        }
        if (dados.numeroEndereco() != null && !dados.numeroEndereco().isBlank()) {
            corpo.put("addressNumber", dados.numeroEndereco());
        }
        if (dados.bairro() != null && !dados.bairro().isBlank()) {
            corpo.put("province", dados.bairro());
        }
        if (dados.cep() != null && !dados.cep().isBlank()) {
            corpo.put("postalCode", dados.cep());
        }
        if (dados.tipoEmpresa() != null && !dados.tipoEmpresa().isBlank()) {
            corpo.put("companyType", dados.tipoEmpresa());
        }
        if (dados.dataNascimento() != null) {
            corpo.put("birthDate", dados.dataNascimento().toString());
        }
        JsonNode resp = postar("/accounts", apiKeyMatriz, corpo, "criação de subconta");
        String contaId = texto(resp, "id");
        String walletId = texto(resp, "walletId");
        String apiKey = texto(resp, "apiKey");
        if (contaId == null || walletId == null || apiKey == null) {
            log.warn("Asaas: criação de subconta devolveu resposta incompleta.");
            throw new ProvedorIndisponivelException();
        }
        return new SubcontaCriada(contaId, walletId, apiKey);
    }

    public StatusContaAsaas consultarStatusConta(String apiKeySubconta) {
        exigirForaDeTransacao();
        JsonNode status = buscar("/myAccount/status", apiKeySubconta, "status da subconta");
        String general = texto(status, "general");
        String commercialInfo = texto(status, "commercialInfo");
        String bankAccountInfo = texto(status, "bankAccountInfo");
        String documentation = texto(status, "documentation");

        String onboardingUrl = null;
        if (!"APPROVED".equalsIgnoreCase(general) || !"APPROVED".equalsIgnoreCase(documentation)) {
            JsonNode docs = buscar("/myAccount/documents", apiKeySubconta, "documentos da subconta");
            onboardingUrl = extrairOnboardingUrl(docs);
        }
        return new StatusContaAsaas(general, commercialInfo, bankAccountInfo, documentation, onboardingUrl);
    }

    public void configurarWebhook(String apiKeySubconta, String urlWebhook, String authToken) {
        exigirForaDeTransacao();
        ObjectNode corpo = json.createObjectNode();
        corpo.put("name", "Overtraining Pay");
        corpo.put("url", urlWebhook);
        corpo.put("enabled", true);
        corpo.put("interrupted", false);
        corpo.put("authToken", authToken);
        corpo.put("sendType", "SEQUENTIALLY");
        ArrayNode eventos = corpo.putArray("events");
        eventos.add("PAYMENT_RECEIVED");
        eventos.add("PAYMENT_CONFIRMED");
        eventos.add("PAYMENT_OVERDUE");
        eventos.add("PAYMENT_REFUNDED");
        eventos.add("PAYMENT_CHARGEBACK_REQUESTED");
        eventos.add("PAYMENT_DELETED");
        postar("/webhooks", apiKeySubconta, corpo, "configuração de webhook");
    }

    public String criarCliente(String apiKeySubconta, String nome, String cpfCnpjSemPontuacao,
                               String email, UUID referenciaAluno) {
        exigirForaDeTransacao();
        ObjectNode corpo = json.createObjectNode();
        corpo.put("name", nome);
        corpo.put("cpfCnpj", cpfCnpjSemPontuacao);
        if (email != null && !email.isBlank()) {
            corpo.put("email", email);
        }
        if (referenciaAluno != null) {
            corpo.put("externalReference", referenciaAluno.toString());
        }
        corpo.put("notificationDisabled", true);
        JsonNode resp = postar("/customers", apiKeySubconta, corpo, "criação de cliente");
        String customerId = texto(resp, "id");
        if (customerId == null) {
            log.warn("Asaas: criação de cliente veio sem id.");
            throw new ProvedorIndisponivelException();
        }
        return customerId;
    }

    public CobrancaPixCriada criarCobrancaPix(String apiKeySubconta, PedidoPixAsaas pedido) {
        exigirForaDeTransacao();
        if (pedido.valorCentavos() < VALOR_MINIMO_CENTAVOS) {
            throw new IllegalArgumentException("Valor mínimo para cobrança Pix no Asaas é R$ 5,00.");
        }
        ObjectNode corpo = json.createObjectNode();
        corpo.put("billingType", "PIX");
        corpo.put("customer", pedido.customerId());
        corpo.put("value", reais(pedido.valorCentavos()));
        corpo.put("dueDate", pedido.vencimento().toString());
        if (pedido.descricao() != null && !pedido.descricao().isBlank()) {
            corpo.put("description", pedido.descricao());
        }
        if (pedido.referenciaExterna() != null && !pedido.referenciaExterna().isBlank()) {
            corpo.put("externalReference", pedido.referenciaExterna());
        }
        adicionarSplits(corpo, pedido.walletIdSubconta(), pedido.splits());

        JsonNode pagamento = postar("/payments", apiKeySubconta, corpo, "criação de cobrança Pix");
        String paymentId = texto(pagamento, "id");
        String status = texto(pagamento, "status");
        String invoiceUrl = texto(pagamento, "invoiceUrl");
        if (paymentId == null) {
            log.warn("Asaas: criação de cobrança Pix veio sem id.");
            throw new ProvedorIndisponivelException();
        }
        JsonNode qr = buscar("/payments/" + codificar(paymentId) + "/pixQrCode", apiKeySubconta, "QR Code Pix");
        String encodedImage = texto(qr, "encodedImage");
        String payload = texto(qr, "payload");
        Instant expiraEm = lerInstant(texto(qr, "expirationDate"));
        return new CobrancaPixCriada(paymentId, status, invoiceUrl, encodedImage, payload, expiraEm);
    }

    public CobrancaCartaoCriada criarCobrancaCartao(String apiKeySubconta, PedidoCartaoAsaas pedido) {
        exigirForaDeTransacao();
        if (pedido.valorCentavos() < VALOR_MINIMO_CENTAVOS) {
            throw new IllegalArgumentException("Valor mínimo para cobrança cartão no Asaas é R$ 5,00.");
        }
        ObjectNode corpo = json.createObjectNode();
        corpo.put("billingType", "CREDIT_CARD");
        corpo.put("customer", pedido.customerId());
        corpo.put("value", reais(pedido.valorCentavos()));
        corpo.put("dueDate", pedido.vencimento().toString());
        if (pedido.descricao() != null && !pedido.descricao().isBlank()) {
            corpo.put("description", pedido.descricao());
        }
        if (pedido.referenciaExterna() != null && !pedido.referenciaExterna().isBlank()) {
            corpo.put("externalReference", pedido.referenciaExterna());
        }
        if (pedido.parcelas() > 1) {
            corpo.put("installmentCount", pedido.parcelas());
            corpo.put("totalValue", reais(pedido.valorCentavos()));
        }
        ObjectNode cc = corpo.putObject("creditCard");
        cc.put("holderName", pedido.cartao().holderName());
        cc.put("number", pedido.cartao().number());
        cc.put("expiryMonth", pedido.cartao().expiryMonth());
        cc.put("expiryYear", pedido.cartao().expiryYear());
        cc.put("ccv", pedido.cartao().ccv());

        ObjectNode holder = corpo.putObject("creditCardHolderInfo");
        holder.put("name", pedido.titular().name());
        holder.put("email", pedido.titular().email());
        holder.put("cpfCnpj", pedido.titular().cpfCnpj());
        holder.put("postalCode", pedido.titular().postalCode());
        holder.put("addressNumber", pedido.titular().addressNumber());
        if (pedido.titular().phone() != null && !pedido.titular().phone().isBlank()) {
            holder.put("phone", pedido.titular().phone());
        }
        if (pedido.remoteIp() != null && !pedido.remoteIp().isBlank()) {
            corpo.put("remoteIp", pedido.remoteIp());
        }
        adicionarSplits(corpo, pedido.walletIdSubconta(), pedido.splits());

        JsonNode pagamento = postar("/payments", apiKeySubconta, corpo, "criação de cobrança cartão");
        String paymentId = texto(pagamento, "id");
        String status = texto(pagamento, "status");
        String invoiceUrl = texto(pagamento, "invoiceUrl");
        Long netCentavos = centavosDeReais(pagamento.path("netValue"));
        if (paymentId == null) {
            log.warn("Asaas: criação de cobrança cartão veio sem id.");
            throw new ProvedorIndisponivelException();
        }
        return new CobrancaCartaoCriada(paymentId, status, invoiceUrl, netCentavos);
    }

    public CobrancaConsultadaAsaas consultarCobranca(String apiKeySubconta, String paymentId) {
        exigirForaDeTransacao();
        JsonNode resp = buscar("/payments/" + codificar(paymentId), apiKeySubconta, "consulta de cobrança");
        String id = texto(resp, "id");
        String status = texto(resp, "status");
        if (id == null || status == null) {
            log.warn("Asaas: consulta de cobrança veio sem id ou status.");
            throw new ProvedorIndisponivelException();
        }
        String billingType = texto(resp, "billingType");
        Long valorCentavos = centavosDeReais(resp.path("value"));
        Long valorLiquidoCentavos = centavosDeReais(resp.path("netValue"));
        String externalReference = texto(resp, "externalReference");
        LocalDate pagoEm = lerData(texto(resp, "confirmedDate"));
        if (pagoEm == null) {
            pagoEm = lerData(texto(resp, "paymentDate"));
        }
        Integer parcelas = resp.path("installmentCount").isIntegralNumber()
                && resp.path("installmentCount").intValue() >= 1
                ? resp.path("installmentCount").intValue() : null;
        return new CobrancaConsultadaAsaas(id, status, billingType, valorCentavos, valorLiquidoCentavos,
                externalReference, pagoEm, parcelas);
    }

    JsonMapper json() {
        return json;
    }

    // ---- helpers internos ----

    private static void adicionarSplits(ObjectNode corpo, String walletIdSubconta, List<SplitAsaas> splits) {
        if (splits == null || splits.isEmpty()) {
            return;
        }
        ArrayNode array = jsonSplitArray(corpo, walletIdSubconta, splits);
        if (array.isEmpty()) {
            corpo.remove("split");
        }
    }

    private static ArrayNode jsonSplitArray(ObjectNode corpo, String walletIdSubconta, List<SplitAsaas> splits) {
        ArrayNode array = corpo.putArray("split");
        for (SplitAsaas item : splits) {
            if (item == null || item.walletId() == null || item.walletId().isBlank()) {
                continue;
            }
            // Regra crítica do Asaas: a walletId da própria subconta emissora NUNCA pode entrar no split.
            if (walletIdSubconta != null && walletIdSubconta.equals(item.walletId())) {
                continue;
            }
            ObjectNode no = array.addObject();
            no.put("walletId", item.walletId());
            if (item.fixedValueCentavos() != null && item.fixedValueCentavos() > 0) {
                no.put("fixedValue", reais(item.fixedValueCentavos()));
            } else if (item.percentualValue() != null && item.percentualValue().compareTo(BigDecimal.ZERO) > 0) {
                no.put("percentualValue", item.percentualValue());
            }
        }
        return array;
    }

    private static String extrairOnboardingUrl(JsonNode docs) {
        JsonNode data = docs.path("data");
        if (!data.isArray()) {
            return texto(docs, "onboardingUrl");
        }
        String fallback = null;
        for (JsonNode item : data) {
            String url = texto(item, "onboardingUrl");
            if (url == null) {
                continue;
            }
            String st = texto(item, "status");
            if (st == null || !"APPROVED".equalsIgnoreCase(st)) {
                return url;
            }
            if (fallback == null) {
                fallback = url;
            }
        }
        return fallback;
    }

    private JsonNode postar(String caminho, String accessToken, ObjectNode corpo, String operacao) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + caminho))
                .timeout(RESPOSTA)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("access_token", accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(corpo)))
                .build();
        return executar(req, operacao);
    }

    private JsonNode buscar(String caminho, String accessToken, String operacao) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + caminho))
                .timeout(RESPOSTA)
                .header("Accept", "application/json")
                .header("access_token", accessToken)
                .GET()
                .build();
        return executar(req, operacao);
    }

    private JsonNode executar(HttpRequest requisicao, String operacao) {
        byte[] bytes;
        try {
            HttpResponse<InputStream> resp = http.send(requisicao, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream entrada = resp.body()) {
                if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                    log.warn("Asaas: {} respondeu {}.", operacao, resp.statusCode());
                    throw new ProvedorIndisponivelException();
                }
                bytes = entrada.readNBytes(MAXIMO_BYTES + 1);
            }
        } catch (IOException e) {
            log.warn("Asaas: {} sem resposta ({}).", operacao, e.getClass().getSimpleName());
            throw new ProvedorIndisponivelException();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProvedorIndisponivelException();
        }
        if (bytes.length > MAXIMO_BYTES) {
            log.warn("Asaas: {} respondeu corpo grande demais.", operacao);
            throw new ProvedorIndisponivelException();
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(bytes);
        } catch (RuntimeException e) {
            log.warn("Asaas: {} respondeu algo que não é JSON.", operacao);
            throw new ProvedorIndisponivelException();
        }
        if (raiz == null || !raiz.isObject()) {
            log.warn("Asaas: {} respondeu JSON que não é objeto.", operacao);
            throw new ProvedorIndisponivelException();
        }
        return raiz;
    }

    private static void exigirForaDeTransacao() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Chamada ao Asaas dentro de uma transação.");
        }
    }

    private static BigDecimal reais(long centavos) {
        return BigDecimal.valueOf(centavos, 2);
    }

    private static Long centavosDeReais(JsonNode no) {
        if (no == null || no.isMissingNode() || no.isNull()) {
            return null;
        }
        if (no.isNumber()) {
            return no.decimalValue().movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValue();
        }
        return null;
    }

    private static String texto(JsonNode no, String campo) {
        JsonNode valor = no.path(campo);
        return valor.isString() && !valor.asString().isBlank() ? valor.asString().strip() : null;
    }

    private static LocalDate lerData(String valor) {
        if (valor == null) {
            return null;
        }
        try {
            return LocalDate.parse(valor.length() >= 10 ? valor.substring(0, 10) : valor);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Instant lerInstant(String valor) {
        if (valor == null) {
            return null;
        }
        try {
            return Instant.parse(valor);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(valor, EXPIRACAO_ASAAS).toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException e) {
                return null;
            }
        }
    }

    private static String codificar(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }
}
