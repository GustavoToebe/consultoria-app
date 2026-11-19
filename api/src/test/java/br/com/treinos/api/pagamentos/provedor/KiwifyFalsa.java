package br.com.treinos.api.pagamentos.provedor;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A Kiwify de mentira: um {@link HttpServer} do JDK em porta efêmera, sem nenhuma chamada à rede real e só com dados fictícios.
 * Simula o OAuth ({@code POST /v1/oauth/token}, formulário com {@code client_id}, {@code client_secret} e {@code grant_type}) e a
 * consulta da venda ({@code GET /v1/sales/{id}} com {@code Authorization: Bearer} de um token emitido aqui e
 * {@code x-kiwify-account-id}), CONFERINDO o que a API real exige. Falha de conferência responde 400 e fica em
 * {@link #violacoes()}: todo teste afirma que a lista está vazia. Uma instância só para a suíte
 * ({@link #compartilhada()}): as classes de teste da Kiwify dividem o mesmo contexto do Spring, cuja URL é a dela.
 */
public final class KiwifyFalsa implements AutoCloseable {

    /** O que {@code GET /v1/sales/{id}} responde (para o pedido que tem venda registrada). */
    public enum ModoDaVenda { OK, HTTP_429, HTTP_500, NAO_ENCONTRADA, JSON_INVALIDO, OUTRO_PEDIDO }

    /** O que {@code POST /v1/oauth/token} responde. */
    public enum ModoDoToken { OK, REJEITADO, HTTP_500 }

    /** Uma requisição recebida. {@code corpo} só existe no OAuth (formulário com a credencial fictícia do teste). */
    public record Requisicao(String metodo, String caminho, String autorizacao, String conta, String tipoDoCorpo, String corpo) {
    }

    private record Venda(String status, String produtoId, String email, Long valorCentavos, String moeda, String meio) {
    }

    private static KiwifyFalsa unica;

    private final HttpServer servidor;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "kiwify-falsa");
        t.setDaemon(true);
        return t;
    });
    private final List<Requisicao> requisicoes = new CopyOnWriteArrayList<>();
    private final List<String> violacoes = new CopyOnWriteArrayList<>();
    private final Map<String, Venda> vendas = new ConcurrentHashMap<>();
    private final Set<String> tokensValidos = ConcurrentHashMap.newKeySet();
    private final AtomicInteger tokensEmitidos = new AtomicInteger();

    private volatile ModoDaVenda modoDaVenda = ModoDaVenda.OK;
    private volatile ModoDoToken modoDoToken = ModoDoToken.OK;
    private volatile int expiraEm = 86400;

    private KiwifyFalsa() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException("Não subiu a Kiwify de mentira.", e);
        }
        servidor.createContext("/", this::tratar);
        servidor.setExecutor(executor);
        servidor.start();
    }

    public static synchronized KiwifyFalsa compartilhada() {
        if (unica == null) {
            unica = new KiwifyFalsa();
        }
        return unica;
    }

    /** A base que a API usa em {@code treinos.pagamentos.kiwify.url-api}: http em 127.0.0.1, que a propriedade aceita nos testes. */
    public String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    /** Volta ao estado limpo (cada teste começa daqui). */
    public void reiniciar() {
        requisicoes.clear();
        violacoes.clear();
        vendas.clear();
        tokensValidos.clear();
        tokensEmitidos.set(0);
        modoDaVenda = ModoDaVenda.OK;
        modoDoToken = ModoDoToken.OK;
        expiraEm = 86400;
    }

    /** Registra a venda que a consulta devolve (a moeda é BRL e o meio, cartão). */
    public void venda(String orderId, String status, String produtoId, String email, Long valorCentavos) {
        vendas.put(orderId, new Venda(status, produtoId, email, valorCentavos, "BRL", "credit_card"));
    }

    public void vendaEmMoeda(String orderId, String status, String produtoId, String email, Long valorCentavos, String moeda) {
        vendas.put(orderId, new Venda(status, produtoId, email, valorCentavos, moeda, "credit_card"));
    }

    public void modoDaVenda(ModoDaVenda modo) {
        this.modoDaVenda = modo;
    }

    public void modoDoToken(ModoDoToken modo) {
        this.modoDoToken = modo;
    }

    public void expiraEm(int segundos) {
        this.expiraEm = segundos;
    }

    /** O token que a Kiwify tinha emitido deixa de valer (a próxima consulta com ele leva 400 auth_error). */
    public void revogarTokens() {
        tokensValidos.clear();
    }

    public int tokensEmitidos() {
        return tokensEmitidos.get();
    }

    public List<Requisicao> requisicoes(String prefixoDoCaminho) {
        return requisicoes.stream().filter(r -> r.caminho().startsWith(prefixoDoCaminho)).toList();
    }

    public List<Requisicao> requisicoes() {
        return List.copyOf(requisicoes);
    }

    public List<String> violacoes() {
        return List.copyOf(violacoes);
    }

    // ---- o servidor ----

    private void tratar(HttpExchange troca) throws IOException {
        String caminho = troca.getRequestURI().getPath();
        String metodo = troca.getRequestMethod();
        String tipo = troca.getRequestHeaders().getFirst("Content-Type");
        String corpo = new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        boolean oauth = "/v1/oauth/token".equals(caminho);
        requisicoes.add(new Requisicao(metodo, caminho, troca.getRequestHeaders().getFirst("Authorization"),
                troca.getRequestHeaders().getFirst("x-kiwify-account-id"), tipo, oauth ? corpo : null));
        try {
            if (oauth) {
                oauth(troca, metodo, tipo, corpo);
            } else if (caminho.startsWith("/v1/sales/")) {
                venda(troca, metodo, caminho.substring("/v1/sales/".length()));
            } else {
                violacoes.add("Caminho que a Kiwify não tem: " + caminho);
                responder(troca, 404, "{}");
            }
        } catch (RuntimeException e) {
            violacoes.add("Erro da mentira: " + e.getClass().getSimpleName());
            responder(troca, 500, "{}");
        }
    }

    private void oauth(HttpExchange troca, String metodo, String tipo, String corpo) throws IOException {
        Map<String, String> campos = formulario(corpo);
        if (!"POST".equals(metodo) || tipo == null || !tipo.startsWith("application/x-www-form-urlencoded")
                || campos.get("client_id") == null || campos.get("client_secret") == null
                || !"client_credentials".equals(campos.get("grant_type"))) {
            violacoes.add("OAuth fora do contrato (método, Content-Type ou campos).");
            responder(troca, 400, "{\"error\":\"auth_error\",\"message\":\"Invalid client: client is invalid\"}");
            return;
        }
        if (modoDoToken == ModoDoToken.HTTP_500) {
            responder(troca, 500, "{}");
            return;
        }
        if (modoDoToken == ModoDoToken.REJEITADO) {
            responder(troca, 400, "{\"error\":\"auth_error\",\"message\":\"Invalid client: client is invalid\"}");
            return;
        }
        String token = "tok-falso-" + tokensEmitidos.incrementAndGet();
        tokensValidos.add(token);
        responder(troca, 200, "{\"access_token\":\"" + token + "\",\"token_type\":\"Bearer\",\"expires_in\":" + expiraEm
                + ",\"scope\":\"sales\"}");
    }

    private void venda(HttpExchange troca, String metodo, String orderId) throws IOException {
        String autorizacao = troca.getRequestHeaders().getFirst("Authorization");
        String conta = troca.getRequestHeaders().getFirst("x-kiwify-account-id");
        if (!"GET".equals(metodo) || conta == null || conta.isBlank() || autorizacao == null || !autorizacao.startsWith("Bearer ")) {
            violacoes.add("Consulta da venda fora do contrato (método ou cabeçalhos).");
            responder(troca, 400, "{\"error\":\"auth_error\",\"message\":\"Invalid token: access token is invalid\"}");
            return;
        }
        if (!tokensValidos.contains(autorizacao.substring("Bearer ".length()))) {
            responder(troca, 400, "{\"error\":\"auth_error\",\"message\":\"Invalid token: access token is invalid\"}");
            return;
        }
        Venda venda = vendas.get(orderId);
        if (modoDaVenda == ModoDaVenda.HTTP_429) {
            responder(troca, 429, "{\"error\":\"too_many_requests\"}");
        } else if (modoDaVenda == ModoDaVenda.HTTP_500) {
            responder(troca, 500, "{}");
        } else if (modoDaVenda == ModoDaVenda.JSON_INVALIDO) {
            responder(troca, 200, "isto não é json");
        } else if (modoDaVenda == ModoDaVenda.NAO_ENCONTRADA || venda == null) {
            responder(troca, 404, "{\"error\":\"not_found\"}");
        } else {
            String id = modoDaVenda == ModoDaVenda.OUTRO_PEDIDO ? "outro-pedido" : orderId;
            responder(troca, 200, json(id, venda));
        }
    }

    /** O corpo no formato do exemplo da documentação (só os campos que importam, mais o que não deve ser lido). */
    private static String json(String id, Venda v) {
        StringBuilder s = new StringBuilder("{\"id\":\"").append(id).append("\",\"type\":\"product\"");
        if (v.status() != null) {
            s.append(",\"status\":\"").append(v.status()).append('"');
        }
        s.append(",\"payment_method\":\"").append(v.meio()).append("\",\"installments\":1");
        if (v.produtoId() != null) {
            s.append(",\"product\":{\"id\":\"").append(v.produtoId()).append("\",\"name\":\"Produto fictício\"}");
        }
        if (v.email() != null) {
            s.append(",\"customer\":{\"id\":\"cli-1\",\"name\":\"Comprador Fictício\",\"email\":\"").append(v.email())
                    .append("\",\"cpf\":\"00000000000\",\"mobile\":\"+5500000000000\"}");
        }
        s.append(",\"payment\":{");
        if (v.valorCentavos() != null) {
            s.append("\"charge_amount\":").append(v.valorCentavos()).append(',');
        }
        s.append("\"charge_currency\":\"").append(v.moeda()).append("\",\"net_amount\":1,\"fee\":1}}");
        return s.toString();
    }

    private static Map<String, String> formulario(String corpo) {
        Map<String, String> campos = new HashMap<>();
        Set<String> vistos = new HashSet<>();
        for (String par : corpo.split("&")) {
            int igual = par.indexOf('=');
            if (igual > 0) {
                String nome = URLDecoder.decode(par.substring(0, igual), StandardCharsets.UTF_8);
                if (vistos.add(nome)) {
                    campos.put(nome, URLDecoder.decode(par.substring(igual + 1), StandardCharsets.UTF_8));
                }
            }
        }
        return campos;
    }

    private static void responder(HttpExchange troca, int status, String corpo) throws IOException {
        byte[] bytes = corpo.getBytes(StandardCharsets.UTF_8);
        troca.getResponseHeaders().add("Content-Type", "application/json");
        troca.sendResponseHeaders(status, bytes.length);
        try (OutputStream saida = troca.getResponseBody()) {
            saida.write(bytes);
        }
    }

    @Override
    public void close() {
        servidor.stop(0);
        executor.shutdownNow();
    }
}
