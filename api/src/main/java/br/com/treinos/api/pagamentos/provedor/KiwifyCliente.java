package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.KiwifyProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Chamadas HTTP à API pública da Kiwify (documentação em docs.kiwify.com.br, conferida em 18/11/2026): o token OAuth
 * ({@code POST /v1/oauth/token}, formulário com {@code client_id}, {@code client_secret} e {@code grant_type}) e a consulta da
 * venda ({@code GET /v1/sales/{order_id}} com {@code Authorization: Bearer} e {@code x-kiwify-account-id}). Tempo máximo de
 * conexão (3 s) e de resposta (8 s), nenhum redirecionamento (o token iria junto) e no máximo 256 KiB lidos. Nunca roda dentro
 * de uma transação e nunca registra corpo, URL, token, segredo nem e-mail do comprador: toda falha (rede, HTTP, 429, JSON,
 * tamanho) vira {@link ProvedorIndisponivelException}, sem causa nem corpo.
 *
 * <p>O token OAuth fica em memória, por consultoria, até {@code expires_in} menos uma folga, preso à impressão digital da
 * credencial (trocar o {@code client_id} ou o segredo descarta o token). Nunca vai a log. Um 400/401/403 com token que veio do
 * cache descarta o token e tenta uma vez com um novo.
 *
 * <p>Os campos lidos da venda ficam todos aqui ({@link #lerVenda}), isolados do resto: se o payload real divergir da
 * documentação, só este método muda.
 */
@Component
public class KiwifyCliente {

    private static final Logger log = LoggerFactory.getLogger(KiwifyCliente.class);
    private static final Duration CONEXAO = Duration.ofSeconds(3);
    private static final Duration RESPOSTA = Duration.ofSeconds(8);
    private static final int MAXIMO_BYTES = 256 * 1024;
    /** A documentação dá 86400 s; o token é renovado esta folga antes de vencer. */
    private static final Duration FOLGA_DO_TOKEN = Duration.ofMinutes(5);
    private static final long VALIDADE_SEM_INFORMACAO_EM_SEGUNDOS = 3600;
    private static final int MAXIMO_DA_FORMA = 20;
    private static final int MAXIMO_DE_PARCELAS = 99;

    /** A credencial decifrada só em memória, para a chamada. */
    public record Credenciais(String clientId, String clientSecret, String accountId) {

        @Override
        public String toString() {
            return "Credenciais[...]";
        }
    }

    /**
     * O que a venda diz e a conciliação confere. {@code email} é do comprador (dado pessoal: nunca em log, auditoria nem
     * resposta; o {@code toString} o esconde). {@code valorCentavos} é {@code payment.charge_amount}, nulo se não veio inteiro.
     */
    public record Venda(String id, String status, String produtoId, String email, Long valorCentavos, String moeda,
                        String meio, Integer parcelas) {

        @Override
        public String toString() {
            return "Venda[...]";
        }
    }

    private record TokenEmCache(String valor, Instant expiraEm, String impressao) {
    }

    private final String base;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(CONEXAO)
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = new JsonMapper();
    private final Map<UUID, TokenEmCache> tokens = new ConcurrentHashMap<>();

    public KiwifyCliente(KiwifyProperties propriedades) {
        this.base = propriedades.urlApi();
    }

    /** A venda no estado de agora, perguntada à Kiwify. Falha de qualquer tipo é {@link ProvedorIndisponivelException}. */
    public Venda consultar(UUID consultoria, Credenciais credenciais, String orderId) {
        exigirForaDeTransacao();
        String impressao = impressao(credenciais);
        for (int tentativa = 0; tentativa < 2; tentativa++) {
            boolean doCache = tentativa == 0 && tokens.containsKey(consultoria);
            String token = token(consultoria, credenciais, impressao);
            Resposta resposta = pedir(HttpRequest.newBuilder(URI.create(base + "/v1/sales/" + codificar(orderId)))
                    .timeout(RESPOSTA).header("Accept", "application/json").header("Authorization", "Bearer " + token)
                    .header("x-kiwify-account-id", credenciais.accountId()).GET().build(), "consulta da venda");
            if (resposta.status() == 200) {
                return lerVenda(lerObjeto(resposta.corpo(), "consulta da venda"), orderId);
            }
            if (doCache && (resposta.status() == 400 || resposta.status() == 401 || resposta.status() == 403)) {
                tokens.remove(consultoria);
                continue;
            }
            log.warn("Kiwify: consulta da venda respondeu {}.", resposta.status());
            throw new ProvedorIndisponivelException();
        }
        throw new ProvedorIndisponivelException();
    }

    /** O token em cache da consultoria deixa de valer (credencial trocada ou removida). */
    public void esquecerToken(UUID consultoria) {
        tokens.remove(consultoria);
    }

    // ---- OAuth ----

    private String token(UUID consultoria, Credenciais credenciais, String impressao) {
        TokenEmCache atual = tokens.get(consultoria);
        if (atual != null && atual.impressao().equals(impressao) && Instant.now().isBefore(atual.expiraEm())) {
            return atual.valor();
        }
        String corpo = "client_id=" + codificar(credenciais.clientId()) + "&client_secret=" + codificar(credenciais.clientSecret())
                + "&grant_type=client_credentials";
        Resposta resposta = pedir(HttpRequest.newBuilder(URI.create(base + "/v1/oauth/token")).timeout(RESPOSTA)
                .header("Content-Type", "application/x-www-form-urlencoded").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(corpo)).build(), "token");
        if (resposta.status() != 200) {
            log.warn("Kiwify: o token OAuth respondeu {}.", resposta.status());
            throw new ProvedorIndisponivelException();
        }
        JsonNode raiz = lerObjeto(resposta.corpo(), "token");
        JsonNode acesso = raiz.path("access_token");
        if (!acesso.isString() || acesso.asString().isBlank()) {
            log.warn("Kiwify: o token OAuth veio sem access_token.");
            throw new ProvedorIndisponivelException();
        }
        long segundos = validadeEmSegundos(raiz.path("expires_in"));
        Duration vida = Duration.ofSeconds(segundos).minus(FOLGA_DO_TOKEN);
        if (vida.compareTo(Duration.ofSeconds(60)) < 0) {
            vida = Duration.ofSeconds(60);
        }
        tokens.put(consultoria, new TokenEmCache(acesso.asString(), Instant.now().plus(vida), impressao));
        return acesso.asString();
    }

    /** {@code expires_in} chega como número (86400) ou texto ("86400"); sem valor útil vale uma hora. */
    private static long validadeEmSegundos(JsonNode no) {
        try {
            long valor = no.isIntegralNumber() ? no.longValue() : no.isString() ? Long.parseLong(no.asString().trim()) : 0;
            return valor > 0 ? valor : VALIDADE_SEM_INFORMACAO_EM_SEGUNDOS;
        } catch (NumberFormatException e) {
            return VALIDADE_SEM_INFORMACAO_EM_SEGUNDOS;
        }
    }

    // ---- a venda (todos os campos lidos da Kiwify ficam aqui) ----

    /**
     * {@code id} tem de ser o pedido pedido; {@code status} (paid, refunded, chargedback, waiting_payment, refused...),
     * {@code product.id}, {@code customer.email} e {@code payment.charge_amount} (centavos, BRL) são o que a baixa confere.
     * {@code payment_method} e {@code installments} são só informação. Campo que falta vira nulo: quem confere trata como
     * "não bate", nunca como "bate".
     */
    static Venda lerVenda(JsonNode raiz, String orderId) {
        String id = texto(raiz.path("id"));
        if (id == null || !id.equalsIgnoreCase(orderId)) {
            log.warn("Kiwify: a venda devolvida não é a pedida.");
            throw new ProvedorIndisponivelException();
        }
        JsonNode pagamento = raiz.path("payment");
        JsonNode valor = pagamento.path("charge_amount");
        return new Venda(id, texto(raiz.path("status")), texto(raiz.path("product").path("id")),
                texto(raiz.path("customer").path("email")),
                valor.isIntegralNumber() && valor.canConvertToLong() ? valor.longValue() : null,
                texto(pagamento.path("charge_currency")), meio(texto(raiz.path("payment_method"))), parcelas(raiz.path("installments")));
    }

    private static String texto(JsonNode no) {
        return no.isString() && !no.asString().isBlank() ? no.asString().strip() : null;
    }

    private static String meio(String meio) {
        if (meio == null) {
            return null;
        }
        String limpo = meio.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        if (limpo.length() > MAXIMO_DA_FORMA) {
            limpo = limpo.substring(0, MAXIMO_DA_FORMA);
        }
        return limpo.isEmpty() ? null : limpo;
    }

    private static Integer parcelas(JsonNode no) {
        return no.isIntegralNumber() && no.canConvertToInt() && no.intValue() >= 1 && no.intValue() <= MAXIMO_DE_PARCELAS
                ? no.intValue() : null;
    }

    // ---- HTTP ----

    private record Resposta(int status, String corpo) {
    }

    private Resposta pedir(HttpRequest requisicao, String operacao) {
        try {
            HttpResponse<InputStream> resp = http.send(requisicao, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream entrada = resp.body()) {
                byte[] corpo = entrada.readNBytes(MAXIMO_BYTES + 1);
                if (corpo.length > MAXIMO_BYTES) {
                    log.warn("Kiwify: {} respondeu um corpo grande demais.", operacao);
                    throw new ProvedorIndisponivelException();
                }
                return new Resposta(resp.statusCode(), new String(corpo, StandardCharsets.UTF_8));
            }
        } catch (IOException e) {
            log.warn("Kiwify: {} sem resposta ({}).", operacao, e.getClass().getSimpleName());
            throw new ProvedorIndisponivelException();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProvedorIndisponivelException();
        }
    }

    private JsonNode lerObjeto(String corpo, String operacao) {
        JsonNode raiz;
        try {
            raiz = json.readTree(corpo);
        } catch (RuntimeException e) {
            // A mensagem do Jackson cita pedaços do corpo: não vai a log nem vira causa.
            log.warn("Kiwify: {} respondeu algo que não é JSON.", operacao);
            throw new ProvedorIndisponivelException();
        }
        if (raiz == null || !raiz.isObject()) {
            log.warn("Kiwify: {} respondeu JSON que não é um objeto.", operacao);
            throw new ProvedorIndisponivelException();
        }
        return raiz;
    }

    private static void exigirForaDeTransacao() {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Chamada à Kiwify dentro de uma transação.");
        }
    }

    private static String codificar(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    /** Só o hash entra no cache: a credencial em si nunca fica guardada aqui. */
    private static String impressao(Credenciais c) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((c.clientId() + "\0" + c.clientSecret() + "\0" + c.accountId()).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }
}
