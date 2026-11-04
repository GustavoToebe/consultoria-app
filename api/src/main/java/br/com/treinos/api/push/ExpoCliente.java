package br.com.treinos.api.push;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Chamada à API de push do Expo, SEMPRE fora de transação. Conexão e resposta com tempo máximo curto, sem redirecionamento
 * (o token de acesso iria junto) e em lotes de até {@value #MAXIMO_POR_CHAMADA} mensagens (limite do Expo). O texto é fixo e
 * sem dado pessoal; o {@code data} leva só o tipo. A resposta é lida só pelo status e pelos tickets (status e
 * {@code details.error}); nada dela, nem o token, vai a log ou à exceção.
 */
@Component
class ExpoCliente {

    static final int MAXIMO_POR_CHAMADA = 100;
    static final String TITULO = "Compromisso atualizado";
    static final String CORPO = "Abra o app para ver o que mudou.";

    /** Falha da chamada inteira (rede, tempo, status que não é 2xx ou resposta que não é JSON). {@code motivo} é curto e sem dado. */
    static class FalhaNoEnvio extends RuntimeException {
        private static final long serialVersionUID = 1L;

        FalhaNoEnvio(String motivo) {
            super(motivo, null, false, false);
        }
    }

    private final PushProperties propriedades;
    private final HttpClient http;
    private final JsonMapper json = new JsonMapper();

    ExpoCliente(PushProperties propriedades) {
        this.propriedades = propriedades;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(propriedades.timeoutSegundos()))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    /**
     * Envia até 100 mensagens e devolve, na ordem dos tokens, o erro do ticket de cada uma ({@code null} = aceita).
     * Lança {@link FalhaNoEnvio} se a chamada falhar.
     */
    List<String> enviar(List<String> tokens) {
        if (tokens.isEmpty() || tokens.size() > MAXIMO_POR_CHAMADA) {
            throw new IllegalArgumentException("Lote fora do limite.");
        }
        ArrayNode mensagens = json.createArrayNode();
        for (String token : tokens) {
            ObjectNode m = mensagens.addObject();
            m.put("to", token);
            m.put("title", TITULO);
            m.put("body", CORPO);
            m.put("sound", "default");
            m.put("priority", "high");
            m.putObject("data").put("tipo", "compromisso");
        }
        HttpRequest.Builder pedido = HttpRequest.newBuilder(URI.create(propriedades.expoUrl()))
                .timeout(Duration.ofSeconds(propriedades.timeoutSegundos()))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(mensagens)));
        if (!propriedades.expoToken().isEmpty()) {
            pedido.header("Authorization", "Bearer " + propriedades.expoToken());
        }
        HttpResponse<String> resposta;
        try {
            resposta = http.send(pedido.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new FalhaNoEnvio(e.getClass().getSimpleName());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FalhaNoEnvio("InterruptedException");
        }
        if (resposta.statusCode() / 100 != 2) {
            throw new FalhaNoEnvio("HTTP_" + resposta.statusCode());
        }
        JsonNode dados;
        try {
            dados = json.readTree(resposta.body()).path("data");
        } catch (RuntimeException e) {
            throw new FalhaNoEnvio("RESPOSTA_INVALIDA");
        }
        // Um 200 sem a lista de tickets, ou com outro tamanho, não diz o que aconteceu com cada mensagem: tenta de novo.
        if (!dados.isArray() || dados.size() != tokens.size()) {
            throw new FalhaNoEnvio("RESPOSTA_INVALIDA");
        }
        List<String> erros = new ArrayList<>();
        for (JsonNode ticket : dados) {
            erros.add("ok".equals(ticket.path("status").asString("")) ? null : codigoDoErro(ticket));
        }
        return erros;
    }

    /** O código do Expo ({@code details.error}, um enum como {@code DeviceNotRegistered}); qualquer outra coisa vira {@code ERRO}. */
    private static String codigoDoErro(JsonNode ticket) {
        String codigo = ticket.path("details").path("error").asString("");
        return codigo.matches("[A-Za-z]{1,40}") ? codigo : "ERRO";
    }
}
