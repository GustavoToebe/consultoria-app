package br.com.treinos.api.auth;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Siteverify de mentira (servidor do JDK, sem rede). O veredito sai do token recebido: {@code token-ok} passa,
 * {@code token-ruim} é recusado, {@code token-segredo} acusa segredo inválido, {@code token-queda} responde 503 e
 * {@code token-lixo} responde algo que não é JSON. Qualquer outro token é recusado. Guarda os campos de cada chamada.
 */
final class SiteverifyFalso implements AutoCloseable {

    static final String OK = "token-ok";
    static final String RUIM = "token-ruim";
    static final String SEGREDO_INVALIDO = "token-segredo";
    static final String QUEDA = "token-queda";
    static final String LIXO = "token-lixo";

    private final HttpServer servidor;
    private final List<Map<String, String>> chamadas = new CopyOnWriteArrayList<>();

    SiteverifyFalso() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        servidor.createContext("/turnstile/v0/siteverify", troca -> {
            String corpo = new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Map<String, String> campos = new LinkedHashMap<>();
            for (String par : corpo.split("&")) {
                int i = par.indexOf('=');
                if (i > 0) {
                    campos.put(URLDecoder.decode(par.substring(0, i), StandardCharsets.UTF_8),
                            URLDecoder.decode(par.substring(i + 1), StandardCharsets.UTF_8));
                }
            }
            chamadas.add(campos);
            String token = campos.getOrDefault("response", "");
            int status = 200;
            String resposta = switch (token) {
                case OK -> "{\"success\":true,\"error-codes\":[]}";
                case SEGREDO_INVALIDO -> "{\"success\":false,\"error-codes\":[\"invalid-input-secret\"]}";
                case QUEDA -> {
                    status = 503;
                    yield "{\"error\":\"fora\"}";
                }
                case LIXO -> "<html>nao e json</html>";
                default -> "{\"success\":false,\"error-codes\":[\"invalid-input-response\"]}";
            };
            byte[] bytes = resposta.getBytes(StandardCharsets.UTF_8);
            troca.getResponseHeaders().add("Content-Type", "application/json");
            troca.sendResponseHeaders(status, bytes.length);
            troca.getResponseBody().write(bytes);
            troca.close();
        });
        servidor.start();
    }

    String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort() + "/turnstile/v0/siteverify";
    }

    List<Map<String, String>> chamadas() {
        return chamadas;
    }

    @Override
    public void close() {
        servidor.stop(0);
    }
}
