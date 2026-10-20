package br.com.treinos.api.pagamentos.provedor;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * A InfinitePay de mentira: um {@link HttpServer} do JDK em porta efêmera, sem nenhuma chamada à rede real. Registra cada
 * requisição e CONFERE o corpo EXATO que a API real exige (caminho, método, Content-Type, {@code handle} sem {@code $}, item
 * único em {@code items}, {@code order_nsu} UUID, sem dado do aluno). O formato do {@code /links} depende da chave: COM
 * {@code X-Api-Key} vão {@code options} (quatro campos) e {@code webhook} (objeto com {@code url} e {@code events}), sem
 * {@code webhook_url}; SEM chave vai só {@code webhook_url}, sem {@code options} nem {@code webhook}. Falha de conferência
 * responde 400 com o motivo e fica em {@link #violacoes()}: todo teste afirma que a lista está vazia. As respostas seguem o
 * cenário configurado.
 */
public final class InfinitePayFalsa implements AutoCloseable {

    /** O que {@code POST /links} responde. */
    public enum ModoDoLink { URL, LINK_E_SLUG, SEM_URL, URL_HTTP, SLUG_INVALIDO, HTTP_500, JSON_INVALIDO, CORPO_GRANDE }

    /** O que {@code POST /payment_check} responde. */
    public enum ModoDaConsulta {
        PAGO_PIX, PAGO_CARTAO, NAO_PAGO, METODO_DESCONHECIDO, METODO_SUJO, SEM_SUCESSO, SEM_CAMPO_SUCESSO, HTTP_500,
        JSON_INVALIDO, CORPO_GRANDE
    }

    /** Uma requisição recebida: {@code chave} é o valor de {@code X-Api-Key} (nulo = o cabeçalho não veio). */
    public record Requisicao(String caminho, String metodo, String chave, JsonNode corpo) {
    }

    private static final Pattern UUID_CANONICO = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern IDENTIFICADOR = Pattern.compile("^[A-Za-z0-9._-]{1,100}$");
    private static final Pattern CAMINHO_DO_AVISO = Pattern.compile("^/publico/pagamentos/infinitepay/[A-Za-z0-9_-]{43}$");
    private static final Set<String> CAMPOS_SEM_CHAVE = Set.of("handle", "items", "order_nsu", "redirect_url", "webhook_url");
    private static final Set<String> CAMPOS_COM_CHAVE = Set.of("handle", "items", "order_nsu", "redirect_url", "options", "webhook");
    private static final Set<String> CAMPOS_DAS_OPCOES = Set.of("payment_methods_enabled", "single_payment", "valid_until",
            "assured_installments");
    private static final Set<String> CAMPOS_DO_WEBHOOK = Set.of("url", "events");
    private static final Set<String> CAMPOS_DA_CONSULTA = Set.of("handle", "order_nsu", "transaction_nsu", "slug");

    private final JsonMapper json = new JsonMapper();
    private final HttpServer servidor;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "infinitepay-falsa");
        t.setDaemon(true);
        return t;
    });
    private final List<Requisicao> requisicoes = new CopyOnWriteArrayList<>();
    private final List<String> violacoes = new CopyOnWriteArrayList<>();
    private final AtomicInteger links = new AtomicInteger();
    private final AtomicBoolean fechada = new AtomicBoolean();

    private volatile ModoDoLink modoDoLink = ModoDoLink.URL;
    private volatile ModoDaConsulta modoDaConsulta = ModoDaConsulta.PAGO_PIX;
    private volatile Long precoEsperado;
    private volatile Boolean exigeChave;
    private volatile String chaveEsperada;
    private volatile String handleEsperado;
    private volatile UUID pedidoEsperado;
    private volatile String tokenEsperado;
    private volatile String descricaoNaoPodeConter;
    private volatile Integer parcelasSemJurosEsperadas;
    private volatile long valorDaConsulta = 15_000L;
    private volatile long jurosDoCartao = 250L;
    private volatile Runnable aoReceberLink;
    private volatile Runnable aoReceberConsulta;

    public InfinitePayFalsa() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException("Não subiu a InfinitePay de mentira.", e);
        }
        servidor.createContext("/", this::tratar);
        servidor.setExecutor(executor);
        servidor.start();
    }

    /** A URL base (http, porta efêmera, só 127.0.0.1) para as propriedades. */
    public String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    /** Volta ao cenário padrão e esquece requisições e violações. */
    public void reiniciar() {
        requisicoes.clear();
        violacoes.clear();
        links.set(0);
        modoDoLink = ModoDoLink.URL;
        modoDaConsulta = ModoDaConsulta.PAGO_PIX;
        precoEsperado = null;
        exigeChave = null;
        chaveEsperada = null;
        handleEsperado = null;
        pedidoEsperado = null;
        tokenEsperado = null;
        descricaoNaoPodeConter = null;
        parcelasSemJurosEsperadas = null;
        valorDaConsulta = 15_000L;
        jurosDoCartao = 250L;
        aoReceberLink = null;
        aoReceberConsulta = null;
    }

    public InfinitePayFalsa linkResponde(ModoDoLink modo) {
        this.modoDoLink = modo;
        return this;
    }

    public InfinitePayFalsa consultaResponde(ModoDaConsulta modo) {
        this.modoDaConsulta = modo;
        return this;
    }

    public InfinitePayFalsa esperaPreco(long centavos) {
        this.precoEsperado = centavos;
        return this;
    }

    /** {@code true}: o cabeçalho X-Api-Key tem de vir; {@code false}: não pode vir; nulo: tanto faz. */
    public InfinitePayFalsa exigeChave(Boolean exigir) {
        this.exigeChave = exigir;
        return this;
    }

    public InfinitePayFalsa esperaChave(String chave) {
        this.chaveEsperada = chave;
        return this;
    }

    public InfinitePayFalsa esperaHandle(String handle) {
        this.handleEsperado = handle;
        return this;
    }

    public InfinitePayFalsa esperaPedido(UUID pedido) {
        this.pedidoEsperado = pedido;
        return this;
    }

    public InfinitePayFalsa esperaTokenDoAviso(String token) {
        this.tokenEsperado = token;
        return this;
    }

    /** O {@code assured_installments} que o link com chave tem de trazer (0 ou 12); nulo: qualquer um dos dois. */
    public InfinitePayFalsa esperaParcelasSemJuros(Integer parcelas) {
        this.parcelasSemJurosEsperadas = parcelas;
        return this;
    }

    /** Texto que a descrição do item não pode trazer (por exemplo o nome do aluno). */
    public InfinitePayFalsa descricaoSemTexto(String texto) {
        this.descricaoNaoPodeConter = texto;
        return this;
    }

    /** O {@code amount} do {@code payment_check}; o {@code paid_amount} do cartão soma juros por cima. */
    public InfinitePayFalsa valorDaConsulta(long centavos) {
        this.valorDaConsulta = centavos;
        return this;
    }

    /** Roda antes de responder cada {@code /links} válido: simula o que acontece no banco enquanto a InfinitePay demora. */
    public InfinitePayFalsa aoReceberLink(Runnable acao) {
        this.aoReceberLink = acao;
        return this;
    }

    /** Roda antes de responder cada {@code /payment_check} válido: simula o que muda no banco enquanto a InfinitePay demora. */
    public InfinitePayFalsa aoReceberConsulta(Runnable acao) {
        this.aoReceberConsulta = acao;
        return this;
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

    // ---- tratamento ----

    private void tratar(HttpExchange troca) throws IOException {
        try (troca) {
            String caminho = troca.getRequestURI().getPath();
            String metodo = troca.getRequestMethod();
            byte[] bytes = troca.getRequestBody().readNBytes(1024 * 1024);
            String chave = troca.getRequestHeaders().getFirst("X-Api-Key");
            JsonNode corpo = null;
            List<String> problemas = new ArrayList<>();
            try {
                corpo = json.readTree(bytes);
            } catch (RuntimeException e) {
                problemas.add("o corpo não é JSON");
            }
            requisicoes.add(new Requisicao(caminho, metodo, chave, corpo));
            conferirGeral(troca, metodo, chave, problemas);
            if (corpo != null) {
                if ("/links".equals(caminho)) {
                    conferirLink(corpo, chave != null, problemas);
                } else if ("/payment_check".equals(caminho)) {
                    conferirConsulta(corpo, problemas);
                } else {
                    problemas.add("caminho inesperado " + caminho);
                }
            }
            if (!problemas.isEmpty()) {
                String motivo = String.join("; ", problemas);
                violacoes.add(caminho + ": " + motivo);
                responder(troca, 400, json.writeValueAsString(json.createObjectNode().put("erro", motivo)));
                return;
            }
            if ("/links".equals(caminho)) {
                responderLink(troca, corpo);
            } else {
                responderConsulta(troca);
            }
        } catch (IOException | RuntimeException e) {
            // Falha de escrita (o cliente largou a resposta grande) não é violação; erro nosso é.
            if (!(e instanceof IOException)) {
                violacoes.add("erro na falsa: " + e.getClass().getSimpleName());
            }
        }
    }

    private void conferirGeral(HttpExchange troca, String metodo, String chave, List<String> problemas) {
        if (!"POST".equals(metodo)) {
            problemas.add("método " + metodo + " em vez de POST");
        }
        String tipo = troca.getRequestHeaders().getFirst("Content-Type");
        if (tipo == null || !tipo.toLowerCase(java.util.Locale.ROOT).startsWith("application/json")) {
            problemas.add("Content-Type não é application/json");
        }
        if (exigeChave != null && exigeChave != (chave != null)) {
            problemas.add(exigeChave ? "faltou o cabeçalho X-Api-Key" : "veio X-Api-Key sem o treinador ter chave");
        }
        if (chaveEsperada != null && chave != null && !chaveEsperada.equals(chave)) {
            problemas.add("X-Api-Key diferente da esperada");
        }
    }

    private void conferirLink(JsonNode corpo, boolean comChave, List<String> problemas) {
        if (!corpo.isObject()) {
            problemas.add("o corpo não é um objeto");
            return;
        }
        Set<String> permitidos = comChave ? CAMPOS_COM_CHAVE : CAMPOS_SEM_CHAVE;
        corpo.propertyNames().forEach(campo -> {
            if (!permitidos.contains(campo)) {
                problemas.add("campo não esperado " + campo + (comChave ? " (com chave)" : " (sem chave)")
                        + ": dado do aluno ou fora do contrato");
            }
        });
        conferirHandle(corpo, problemas);
        JsonNode itens = corpo.path("items");
        if (!itens.isArray() || itens.size() != 1) {
            problemas.add("items precisa ter exatamente 1 item");
        } else {
            JsonNode item = itens.get(0);
            Set<String> camposDoItem = new HashSet<>();
            item.propertyNames().forEach(camposDoItem::add);
            if (!camposDoItem.equals(Set.of("quantity", "price", "description"))) {
                problemas.add("o item precisa ter exatamente quantity, price e description");
            }
            if (!item.path("quantity").isIntegralNumber() || item.path("quantity").longValue() != 1) {
                problemas.add("quantity diferente de 1");
            }
            JsonNode preco = item.path("price");
            if (!preco.isIntegralNumber() || preco.longValue() <= 0) {
                problemas.add("price não é inteiro positivo em centavos");
            } else if (precoEsperado != null && preco.longValue() != precoEsperado) {
                problemas.add("price diferente do valor da cobrança no servidor");
            }
            JsonNode descricao = item.path("description");
            if (!descricao.isString() || descricao.asString().isBlank()) {
                problemas.add("description vazia");
            } else if (descricaoNaoPodeConter != null && descricao.asString().contains(descricaoNaoPodeConter)) {
                problemas.add("description traz texto proibido");
            }
        }
        conferirPedido(corpo, problemas);
        JsonNode retorno = corpo.path("redirect_url");
        if (!retorno.isMissingNode() && (!retorno.isString() || !retorno.asString().startsWith("https://"))) {
            problemas.add("redirect_url não é https");
        }
        if (comChave) {
            conferirOpcoes(corpo.path("options"), problemas);
            conferirWebhookObjeto(corpo.path("webhook"), problemas);
        } else {
            conferirUrlDoAviso(corpo.path("webhook_url"), "webhook_url", problemas);
        }
    }

    private void conferirUrlDoAviso(JsonNode aviso, String campo, List<String> problemas) {
        if (!aviso.isString() || !aviso.asString().startsWith("https://")) {
            problemas.add(campo + " ausente ou não é https");
            return;
        }
        String caminho = java.net.URI.create(aviso.asString()).getPath();
        if (caminho == null || !CAMINHO_DO_AVISO.matcher(caminho).matches()) {
            problemas.add(campo + " sem o token no caminho");
        } else if (tokenEsperado != null && !caminho.endsWith("/" + tokenEsperado)) {
            problemas.add(campo + " com outro token");
        }
    }

    private void conferirWebhookObjeto(JsonNode webhook, List<String> problemas) {
        if (!webhook.isObject()) {
            problemas.add("webhook (objeto) ausente");
            return;
        }
        Set<String> campos = new HashSet<>();
        webhook.propertyNames().forEach(campos::add);
        if (!campos.equals(CAMPOS_DO_WEBHOOK)) {
            problemas.add("webhook precisa ter exatamente url e events");
        }
        conferirUrlDoAviso(webhook.path("url"), "webhook.url", problemas);
        List<String> eventos = new ArrayList<>();
        webhook.path("events").forEach(e -> eventos.add(e.asString("")));
        if (!eventos.equals(List.of("paid", "refunded"))) {
            problemas.add("webhook.events precisa ser [paid, refunded]");
        }
    }

    private void conferirOpcoes(JsonNode opcoes, List<String> problemas) {
        if (!opcoes.isObject()) {
            problemas.add("options ausente");
            return;
        }
        Set<String> campos = new HashSet<>();
        opcoes.propertyNames().forEach(campos::add);
        if (!campos.equals(CAMPOS_DAS_OPCOES)) {
            problemas.add("options precisa ter exatamente " + CAMPOS_DAS_OPCOES + " e veio " + campos);
        }
        Set<String> metodos = new HashSet<>();
        opcoes.path("payment_methods_enabled").forEach(m -> metodos.add(m.asString("")));
        if (!metodos.equals(Set.of("pix", "credit_card"))) {
            problemas.add("payment_methods_enabled precisa ser pix e credit_card");
        }
        JsonNode unica = opcoes.path("single_payment");
        if (!(unica.isBoolean() && unica.asBoolean())) {
            problemas.add("single_payment precisa ser true");
        }
        JsonNode parcelas = opcoes.path("assured_installments");
        if (!parcelas.isIntegralNumber() || (parcelas.intValue() != 0 && parcelas.intValue() != 12)) {
            problemas.add("assured_installments precisa ser 0 ou 12");
        } else if (parcelasSemJurosEsperadas != null && parcelas.intValue() != parcelasSemJurosEsperadas) {
            problemas.add("assured_installments diferente do esperado");
        }
        try {
            Instant ate = Instant.parse(opcoes.path("valid_until").asString(""));
            Instant agora = Instant.now();
            if (!ate.isAfter(agora) || ate.isAfter(agora.plus(364, ChronoUnit.DAYS))) {
                problemas.add("valid_until fora de (agora, agora + 364 dias]");
            }
        } catch (RuntimeException e) {
            problemas.add("valid_until ausente ou não é ISO 8601");
        }
    }

    private void conferirConsulta(JsonNode corpo, List<String> problemas) {
        if (!corpo.isObject()) {
            problemas.add("o corpo não é um objeto");
            return;
        }
        corpo.propertyNames().forEach(campo -> {
            if (!CAMPOS_DA_CONSULTA.contains(campo)) {
                problemas.add("campo não esperado " + campo);
            }
        });
        conferirHandle(corpo, problemas);
        conferirPedido(corpo, problemas);
        if (!corpo.path("transaction_nsu").isString() || !IDENTIFICADOR.matcher(corpo.path("transaction_nsu").asString()).matches()) {
            problemas.add("transaction_nsu ausente ou fora do formato");
        }
        JsonNode slug = corpo.path("slug");
        if (!slug.isMissingNode() && (!slug.isString() || !IDENTIFICADOR.matcher(slug.asString()).matches())) {
            problemas.add("slug fora do formato");
        }
    }

    private void conferirHandle(JsonNode corpo, List<String> problemas) {
        JsonNode handle = corpo.path("handle");
        if (!handle.isString() || handle.asString().isBlank() || handle.asString().startsWith("$")) {
            problemas.add("handle ausente ou com $");
        } else if (handleEsperado != null && !handleEsperado.equals(handle.asString())) {
            problemas.add("handle diferente da Tag do treinador");
        }
    }

    private void conferirPedido(JsonNode corpo, List<String> problemas) {
        JsonNode pedido = corpo.path("order_nsu");
        if (!pedido.isString() || !UUID_CANONICO.matcher(pedido.asString()).matches()) {
            problemas.add("order_nsu não é UUID");
        } else if (pedidoEsperado != null && !pedidoEsperado.toString().equals(pedido.asString())) {
            problemas.add("order_nsu diferente do id da cobrança");
        }
    }

    // ---- respostas ----

    private void responderLink(HttpExchange troca, JsonNode corpo) throws IOException {
        Runnable acao = aoReceberLink;
        if (acao != null) {
            acao.run();
        }
        String pedido = corpo.path("order_nsu").asString("");
        String slug = "slug" + links.incrementAndGet() + "-" + pedido.replace("-", "").substring(0, 8);
        String endereco = "https://checkout.falsa.test/pagar/" + slug;
        switch (modoDoLink) {
            case URL -> responder(troca, 200, "{\"url\":\"" + endereco + "\"}");
            case LINK_E_SLUG -> responder(troca, 200, "{\"link\":\"" + endereco + "\",\"slug\":\"" + slug + "\"}");
            case SEM_URL -> responder(troca, 200, "{\"slug\":\"" + slug + "\"}");
            case URL_HTTP -> responder(troca, 200, "{\"url\":\"http://checkout.falsa.test/pagar/" + slug + "\"}");
            case SLUG_INVALIDO -> responder(troca, 200, "{\"url\":\"" + endereco + "\",\"slug\":\"com espaço/e barra\"}");
            case HTTP_500 -> responder(troca, 500, "{\"erro\":\"SEGREDO-DO-CORPO-DE-ERRO\"}");
            case JSON_INVALIDO -> responder(troca, 200, "isto nao e json SEGREDO-DO-CORPO-INVALIDO");
            case CORPO_GRANDE -> responder(troca, 200, "{\"url\":\"https://checkout.falsa.test/" + "a".repeat(100_000) + "\"}");
        }
    }

    private void responderConsulta(HttpExchange troca) throws IOException {
        Runnable acao = aoReceberConsulta;
        if (acao != null) {
            acao.run();
        }
        long valor = valorDaConsulta;
        switch (modoDaConsulta) {
            case PAGO_PIX -> responder(troca, 200, pago(valor, valor, "1", "pix"));
            case PAGO_CARTAO -> responder(troca, 200, pago(valor, valor + jurosDoCartao, "3", "credit_card"));
            case METODO_DESCONHECIDO -> responder(troca, 200, pago(valor, valor, "1", "boleto"));
            // Nome com maiúscula, espaço, acento e comprimento acima do limite; parcelas zero (inválido).
            case METODO_SUJO -> responder(troca, 200,
                    pago(valor, valor, "0", "Pix 2.0 / ÉXTRA-muito-longo-123456789"));
            case NAO_PAGO -> responder(troca, 200, "{\"success\":true,\"paid\":false,\"amount\":" + valor + "}");
            case SEM_SUCESSO -> responder(troca, 200, "{\"success\":false,\"paid\":false}");
            case SEM_CAMPO_SUCESSO -> responder(troca, 200, "{\"paid\":false,\"amount\":" + valor + "}");
            case HTTP_500 -> responder(troca, 500, "{\"erro\":\"SEGREDO-DO-CORPO-DE-ERRO\"}");
            case JSON_INVALIDO -> responder(troca, 200, "[nao] e json SEGREDO-DO-CORPO-INVALIDO");
            case CORPO_GRANDE -> responder(troca, 200, "{\"success\":true,\"paid\":true,\"x\":\"" + "a".repeat(100_000) + "\"}");
        }
    }

    private static String pago(long valor, long pago, String parcelas, String metodo) {
        return "{\"success\":true,\"paid\":true,\"amount\":" + valor + ",\"paid_amount\":" + pago + ",\"installments\":"
                + parcelas + ",\"capture_method\":\"" + metodo + "\"}";
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
