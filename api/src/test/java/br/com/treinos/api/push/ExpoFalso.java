package br.com.treinos.api.push;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * API de push do Expo de mentira (servidor do JDK, sem rede). Guarda o corpo e o {@code Authorization} de cada chamada e
 * responde o que o teste mandar: tickets {@code ok} (padrão), {@code DeviceNotRegistered}, status 500 ou demora (para estourar o
 * tempo máximo). Nunca fala com o Expo real.
 */
final class ExpoFalso {

    record Chamada(String corpo, String autorizacao) { }

    /** Como responder à próxima chamada. */
    enum Modo { OK, DEVICE_NOT_REGISTERED, ERRO_500, LENTO }

    private final HttpServer servidor;
    private final List<Chamada> chamadas = new CopyOnWriteArrayList<>();
    private volatile Modo modo = Modo.OK;

    ExpoFalso() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        servidor.createContext("/push/send", troca -> {
            String corpo = new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            chamadas.add(new Chamada(corpo, troca.getRequestHeaders().getFirst("Authorization")));
            int quantas = corpo.split("\"to\"", -1).length - 1;
            int status = 200;
            String resposta;
            switch (modo) {
                case ERRO_500 -> {
                    status = 500;
                    resposta = "{\"errors\":[{\"message\":\"fora\"}]}";
                }
                case LENTO -> {
                    try {
                        Thread.sleep(2_000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    resposta = tickets(quantas, "{\"status\":\"ok\",\"id\":\"ticket\"}");
                }
                case DEVICE_NOT_REGISTERED -> resposta = tickets(quantas,
                        "{\"status\":\"error\",\"message\":\"x\",\"details\":{\"error\":\"DeviceNotRegistered\"}}");
                default -> resposta = tickets(quantas, "{\"status\":\"ok\",\"id\":\"ticket\"}");
            }
            byte[] bytes = resposta.getBytes(StandardCharsets.UTF_8);
            troca.getResponseHeaders().add("Content-Type", "application/json");
            try {
                troca.sendResponseHeaders(status, bytes.length);
                troca.getResponseBody().write(bytes);
            } catch (IOException cliente) {
                // O cliente já desistiu (tempo máximo): nada a fazer.
            } finally {
                troca.close();
            }
        });
        servidor.start();
    }

    private static String tickets(int quantas, String ticket) {
        return "{\"data\":[" + String.join(",", java.util.Collections.nCopies(quantas, ticket)) + "]}";
    }

    String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort() + "/push/send";
    }

    List<Chamada> chamadas() {
        return chamadas;
    }

    void modo(Modo novo) {
        modo = novo;
    }

    /** Limpa o que foi recebido e volta ao modo normal (entre um teste e outro). */
    void zerar() {
        chamadas.clear();
        modo = Modo.OK;
    }

    /** Todos os tokens que chegaram, na ordem. */
    List<String> destinatarios() {
        return chamadas.stream().flatMap(c -> java.util.regex.Pattern.compile("\"to\":\"([^\"]+)\"").matcher(c.corpo()).results()
                .map(m -> m.group(1))).toList();
    }
}
