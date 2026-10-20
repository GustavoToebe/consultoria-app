package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.InfinitePayProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Chamadas HTTP à API de checkout da InfinitePay. Tem tempo máximo de conexão e de resposta, não segue redirecionamento
 * (a chave iria junto) e lê no máximo 64 KiB da resposta. Nunca roda dentro de uma transação (prenderia uma conexão do
 * banco enquanto a rede responde) e nunca registra corpo, URL, Tag nem chave. Qualquer falha de rede, HTTP, JSON ou
 * tamanho vira {@link ProvedorIndisponivelException}, que não carrega causa nem corpo.
 */
@Component
class InfinitePayCliente {

    private static final Logger log = LoggerFactory.getLogger(InfinitePayCliente.class);
    private static final Duration CONEXAO = Duration.ofSeconds(5);
    private static final Duration RESPOSTA = Duration.ofSeconds(15);
    /** A resposta da API é um objeto pequeno; acima disto algo está errado e o corpo é descartado. */
    private static final int MAXIMO_BYTES = 64 * 1024;

    private final String base;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(CONEXAO)
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = new JsonMapper();

    InfinitePayCliente(InfinitePayProperties propriedades) {
        this.base = propriedades.apiUrl();
    }

    /**
     * POST de {@code corpo} (objeto JSON) em {@code caminho} e a resposta lida como objeto JSON. {@code segredo} vai em
     * {@code X-Api-Key} só quando existe: sem ele a documentação diz que basta a InfiniteTag.
     */
    JsonNode postar(String caminho, String segredo, JsonNode corpo) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Chamada ao provedor de pagamento dentro de uma transação.");
        }
        HttpRequest.Builder requisicao = HttpRequest.newBuilder(URI.create(base + caminho)).timeout(RESPOSTA)
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(corpo)));
        if (segredo != null) {
            requisicao.header("X-Api-Key", segredo);
        }
        byte[] resposta;
        try {
            HttpResponse<InputStream> resp = http.send(requisicao.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream entrada = resp.body()) {
                if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                    log.warn("InfinitePay: {} respondeu {}.", caminho, resp.statusCode());
                    throw new ProvedorIndisponivelException();
                }
                resposta = entrada.readNBytes(MAXIMO_BYTES + 1);
            }
        } catch (IOException e) {
            log.warn("InfinitePay: {} sem resposta ({}).", caminho, e.getClass().getSimpleName());
            throw new ProvedorIndisponivelException();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProvedorIndisponivelException();
        }
        if (resposta.length > MAXIMO_BYTES) {
            log.warn("InfinitePay: {} respondeu um corpo grande demais.", caminho);
            throw new ProvedorIndisponivelException();
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(resposta);
        } catch (RuntimeException e) {
            // A mensagem do Jackson cita pedaços do corpo: não vai a log nem vira causa.
            log.warn("InfinitePay: {} respondeu algo que não é JSON.", caminho);
            throw new ProvedorIndisponivelException();
        }
        if (raiz == null || !raiz.isObject()) {
            log.warn("InfinitePay: {} respondeu JSON que não é um objeto.", caminho);
            throw new ProvedorIndisponivelException();
        }
        return raiz;
    }

    JsonMapper json() {
        return json;
    }
}
