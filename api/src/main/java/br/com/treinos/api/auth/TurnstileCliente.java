package br.com.treinos.api.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Chamada ao siteverify da Cloudflare. Tem tempo máximo de conexão e de resposta: a Cloudflare travada nunca prende uma
 * requisição por muito tempo. Não segue redirecionamento (o segredo iria junto) e nunca registra token, segredo nem IP.
 * Resposta que não é JSON, status 5xx, falha de rede e erro de chave ({@code invalid-input-secret}, um erro nosso, não da
 * pessoa) viram {@link VerificacaoHumanaException#indisponivel()}; o resto é "recusada" ou "aprovada".
 */
class TurnstileCliente {

    enum Veredito { APROVADO, RECUSADO }

    private static final Logger log = LoggerFactory.getLogger(TurnstileCliente.class);
    private static final Duration CONEXAO = Duration.ofSeconds(3);
    private static final Duration RESPOSTA = Duration.ofSeconds(5);

    private final TurnstileProperties propriedades;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(CONEXAO).followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = new JsonMapper();

    TurnstileCliente(TurnstileProperties propriedades) {
        this.propriedades = propriedades;
    }

    Veredito verificar(String token, String ipDoCliente) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("secret", propriedades.segredo());
        campos.put("response", token);
        if (ipDoCliente != null && !ipDoCliente.isBlank()) {
            campos.put("remoteip", ipDoCliente);
        }
        String corpo = campos.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        HttpRequest requisicao = HttpRequest.newBuilder(URI.create(propriedades.verifyUrl())).timeout(RESPOSTA)
                .header("Content-Type", "application/x-www-form-urlencoded").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(corpo)).build();
        HttpResponse<String> resposta;
        try {
            resposta = http.send(requisicao, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            log.warn("Turnstile: siteverify sem resposta ({}).", e.getClass().getSimpleName());
            throw VerificacaoHumanaException.indisponivel();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw VerificacaoHumanaException.indisponivel();
        }
        if (resposta.statusCode() >= 500) {
            log.warn("Turnstile: siteverify respondeu {}.", resposta.statusCode());
            throw VerificacaoHumanaException.indisponivel();
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(resposta.body());
        } catch (RuntimeException e) {
            log.warn("Turnstile: resposta do siteverify não é JSON (status {}).", resposta.statusCode());
            throw VerificacaoHumanaException.indisponivel();
        }
        if (raiz != null && raiz.path("success").asBoolean(false)) {
            return Veredito.APROVADO;
        }
        // Erro de chave é problema de configuração nosso, não do visitante: falha fechada como "indisponível".
        for (JsonNode codigo : raiz == null ? json.createArrayNode() : raiz.path("error-codes")) {
            String texto = codigo.asString("");
            if (texto.equals("invalid-input-secret") || texto.equals("missing-input-secret")) {
                log.error("Turnstile: o segredo (TREINOS_TURNSTILE_SEGREDO) foi recusado pela Cloudflare.");
                throw VerificacaoHumanaException.indisponivel();
            }
        }
        return Veredito.RECUSADO;
    }
}
