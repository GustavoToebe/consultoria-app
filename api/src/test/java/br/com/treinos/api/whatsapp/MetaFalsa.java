package br.com.treinos.api.whatsapp;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Graph API da Meta de mentira (servidor do JDK, sem rede). Guarda o método, o caminho, o corpo e o {@code Authorization} de
 * cada chamada e responde o que o teste mandar: envio aceito (padrão, com um id {@code wamid...} novo), token inválido (400 com
 * o código 190), modelo inexistente (400, 132001), limite de taxa (429, 80007), erro 500, 200 sem id ou demora (para estourar o
 * tempo máximo); a lista de modelos é a que o teste configurar. {@link #aoEnviar} roda dentro do tratador do servidor, antes de
 * responder (serve para provar o que acontece no banco enquanto a chamada HTTP está em curso). Nunca fala com a Meta real.
 */
final class MetaFalsa {

    record Chamada(String metodo, String caminho, String corpo, String autorizacao) {

        /** O telefone de destino do corpo de um envio. */
        String para() {
            Matcher m = Pattern.compile("\"to\":\"([^\"]+)\"").matcher(corpo);
            return m.find() ? m.group(1) : null;
        }
    }

    enum Modo { OK, TOKEN_INVALIDO, MODELO_INEXISTENTE, LIMITE_DE_TAXA, ERRO_500, SEM_ID, LENTO }

    private final HttpServer servidor;
    private final List<Chamada> chamadas = new CopyOnWriteArrayList<>();
    private final List<String> modelos = new CopyOnWriteArrayList<>();
    private volatile Modo modo = Modo.OK;
    private volatile Consumer<Chamada> aoEnviar = c -> { };

    MetaFalsa() {
        try {
            servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        servidor.createContext("/", this::tratar);
        servidor.start();
    }

    private void tratar(HttpExchange troca) throws IOException {
        String corpo = new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Chamada chamada = new Chamada(troca.getRequestMethod(), troca.getRequestURI().toString(), corpo,
                troca.getRequestHeaders().getFirst("Authorization"));
        chamadas.add(chamada);
        int status = 200;
        String resposta;
        if (chamada.caminho().contains("/message_templates")) {
            if (modo == Modo.TOKEN_INVALIDO) {
                status = 400;
                resposta = "{\"error\":{\"message\":\"Invalid OAuth access token.\",\"code\":190}}";
            } else {
                resposta = "{\"data\":[" + String.join(",", modelos) + "]}";
            }
        } else {
            aoEnviar.accept(chamada);
            switch (modo) {
                case TOKEN_INVALIDO -> {
                    status = 400;
                    resposta = "{\"error\":{\"message\":\"Invalid OAuth access token.\",\"code\":190}}";
                }
                case MODELO_INEXISTENTE -> {
                    status = 400;
                    resposta = "{\"error\":{\"message\":\"Template name does not exist\",\"code\":132001}}";
                }
                case LIMITE_DE_TAXA -> {
                    status = 429;
                    resposta = "{\"error\":{\"message\":\"Too many\",\"code\":80007}}";
                }
                case ERRO_500 -> {
                    status = 500;
                    resposta = "{\"error\":{\"message\":\"fora\"}}";
                }
                case SEM_ID -> resposta = "{\"messaging_product\":\"whatsapp\"}";
                case LENTO -> {
                    dormir(2_000);
                    resposta = aceita();
                }
                default -> resposta = aceita();
            }
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
    }

    private static String aceita() {
        return "{\"messaging_product\":\"whatsapp\",\"contacts\":[{\"input\":\"x\",\"wa_id\":\"x\"}],\"messages\":[{\"id\":\"wamid."
                + UUID.randomUUID().toString().replace("-", "") + "\"}]}";
    }

    private static void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** A base da Graph API (a propriedade {@code treinos.whatsapp.meta-url}). */
    String url() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    List<Chamada> chamadas() {
        return chamadas;
    }

    /** Só as chamadas feitas com este token de acesso (cada teste usa o seu, num banco compartilhado). */
    List<Chamada> chamadasDe(String token) {
        return chamadas.stream().filter(c -> ("Bearer " + token).equals(c.autorizacao())).toList();
    }

    /** Só os envios (não a lista de modelos) feitos com este token. */
    List<Chamada> enviosDe(String token) {
        return chamadasDe(token).stream().filter(c -> "POST".equals(c.metodo())).toList();
    }

    void modo(Modo novo) {
        modo = novo;
    }

    void aoEnviar(Consumer<Chamada> acao) {
        aoEnviar = acao;
    }

    /** Um modelo na lista que a Meta devolve. */
    void modeloNaConta(String nome, String idioma, String situacao) {
        modelos.add("{\"name\":\"" + nome + "\",\"language\":\"" + idioma + "\",\"status\":\"" + situacao + "\"}");
    }

    /** Volta ao estado inicial (entre um teste e outro). */
    void zerar() {
        chamadas.clear();
        modelos.clear();
        modo = Modo.OK;
        aoEnviar = c -> { };
    }

    List<String> paraDeTodos() {
        List<String> destinos = new ArrayList<>();
        chamadas.forEach(c -> {
            if (c.para() != null) {
                destinos.add(c.para());
            }
        });
        return destinos;
    }
}
