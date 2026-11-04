package br.com.treinos.api.push;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * API de push do Expo de mentira (servidor do JDK, sem rede). Guarda o corpo e o {@code Authorization} de cada chamada e
 * responde o que o teste mandar: tickets {@code ok} (padrão), {@code DeviceNotRegistered} (para todos ou só para os tokens
 * "mortos"), {@code MessageRateExceeded} uma vez só para os tokens "limitados", {@code InvalidCredentials}, status 500, resposta 200 sem {@code data} ou com a lista de outro tamanho, ou demora
 * (para estourar o tempo máximo). Os tickets saem na ordem dos tokens do corpo. Nunca fala com o Expo real.
 */
final class ExpoFalso {

    record Chamada(String corpo, String autorizacao) { }

    /** Como responder à próxima chamada. */
    enum Modo { OK, DEVICE_NOT_REGISTERED, INVALID_CREDENTIALS, ERRO_500, LENTO, SEM_DATA, LISTA_CURTA }

    private final HttpServer servidor;
    private final List<Chamada> chamadas = new CopyOnWriteArrayList<>();
    private volatile Modo modo = Modo.OK;
    private final Set<String> mortos = ConcurrentHashMap.newKeySet();
    private final Set<String> limitados = ConcurrentHashMap.newKeySet();

    ExpoFalso() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        servidor.createContext("/push/send", troca -> {
            String corpo = new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            chamadas.add(new Chamada(corpo, troca.getRequestHeaders().getFirst("Authorization")));
            List<String> tokens = destinatariosDe(corpo);
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
                    resposta = tickets(tokens, null);
                }
                case DEVICE_NOT_REGISTERED -> resposta = tickets(tokens, t -> "DeviceNotRegistered");
                case INVALID_CREDENTIALS -> resposta = tickets(tokens, t -> "InvalidCredentials");
                case SEM_DATA -> resposta = "{\"errors\":[{\"message\":\"sem data\"}]}";
                case LISTA_CURTA -> resposta = tickets(tokens.subList(0, tokens.size() - 1), null);
                default -> resposta = tickets(tokens, t -> mortos.contains(t) ? "DeviceNotRegistered"
                        : limitados.remove(t) ? "MessageRateExceeded" : null);
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

    /** Um ticket por token: {@code ok}, ou {@code error} com o código que a função devolver (nulo = ok). */
    private static String tickets(List<String> tokens, Function<String, String> erroDoToken) {
        return "{\"data\":[" + tokens.stream().map(t -> {
            String erro = erroDoToken == null ? null : erroDoToken.apply(t);
            return erro == null ? "{\"status\":\"ok\",\"id\":\"ticket\"}"
                    : "{\"status\":\"error\",\"message\":\"x\",\"details\":{\"error\":\"" + erro + "\"}}";
        }).collect(Collectors.joining(",")) + "]}";
    }

    private static List<String> destinatariosDe(String corpo) {
        return Pattern.compile("\"to\":\"([^\"]+)\"").matcher(corpo).results().map(m -> m.group(1)).toList();
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

    /** No modo normal, este token responde {@code DeviceNotRegistered} e os outros do mesmo corpo, {@code ok}. */
    void matar(String token) {
        mortos.add(token);
    }

    /** No modo normal, a PRÓXIMA mensagem para este token responde {@code MessageRateExceeded}; as seguintes, {@code ok}. */
    void limitarUmaVez(String token) {
        limitados.add(token);
    }

    /** Limpa o que foi recebido e volta ao modo normal (entre um teste e outro). */
    void zerar() {
        chamadas.clear();
        mortos.clear();
        limitados.clear();
        modo = Modo.OK;
    }

    /** Todos os tokens que chegaram, na ordem. */
    List<String> destinatarios() {
        return chamadas.stream().flatMap(c -> destinatariosDe(c.corpo()).stream()).toList();
    }
}
