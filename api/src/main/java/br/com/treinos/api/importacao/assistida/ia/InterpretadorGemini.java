package br.com.treinos.api.importacao.assistida.ia;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Conector para Google Gemini (gemini-2.5-flash e gemini-2.5-pro) usando HttpClient nativo do Java 25.
 * Envia SÓ o texto redigido (LGPD), sem PDF bruto nem nome de arquivo, e só quando o roteador libera
 * ({@code enviar-dados-ao-provedor}). A chave vai no cabeçalho, nunca na URL.
 */
@Component
public class InterpretadorGemini implements InterpretadorIa {

    private final ConfiguracaoIaImportacao config;
    private final JsonMapper json;
    private final HttpClient http;

    public InterpretadorGemini(ConfiguracaoIaImportacao config, JsonMapper json) {
        this.config = config;
        this.json = json;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Override
    public String nomeProvedor() {
        return "gemini";
    }

    @Override
    public ResultadoInterpretacao interpretar(ContextoIa contexto) {
        String apiKey = config.getGeminiApiKey();
        if (apiKey.isBlank()) {
            throw new IllegalStateException("Chave da API Gemini não configurada.");
        }

        String modelo = config.getModeloPadrao();
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent";

        try {
            String corpoRequisicao = montarCorpo(contexto);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(corpoRequisicao, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                // Corpo da resposta fora da mensagem: pode ecoar o conteúdo enviado.
                throw new IllegalStateException("Falha na chamada Gemini (HTTP " + response.statusCode() + ").");
            }

            return processarResposta(response.body(), contexto);
        } catch (IllegalStateException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Consulta ao Gemini interrompida.");
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao consultar Google Gemini (" + e.getClass().getSimpleName() + ").");
        }
    }

    private String montarCorpo(ContextoIa contexto) throws Exception {
        Map<String, Object> req = new java.util.HashMap<>();

        // Prompt de Sistema com regras da metodologia e privacidade
        String promptSistema = "Você é o assistente de importação da plataforma Overtraining.\n"
                + "Extraia cadastros de alunos, pesos, planos de treino (divisões, exercícios, séries, repetições, descanso) "
                + "e planos de dieta (refeições, horários, alimentos com quantidade e unidade).\n"
                + "Metodologia da consultoria: tipos de séries permitidos: " + String.join(", ", contexto.metodosConsultoria()) + ".\n"
                + "Dicionário de abreviações conhecidas da consultoria:\n" + DecodificadorDaProposta.formatarApelidos(contexto.apelidosConhecidos()) + "\n"
                + "Nunca invente dados inexistentes: se não houver repetição ou peso, deixe nulo.\n"
                + "Responda OBRIGATORIAMENTE em JSON no formato especificado.";

        Map<String, Object> systemInstruction = Map.of(
                "parts", List.of(Map.of("text", promptSistema))
        );
        req.put("system_instruction", systemInstruction);

        List<Map<String, Object>> parts = List.of(Map.of("text", DecodificadorDaProposta.textoParaEnvio(contexto)));

        req.put("contents", List.of(Map.of("parts", parts)));
        req.put("generationConfig", Map.of("responseMimeType", "application/json"));

        return json.writeValueAsString(req);
    }

    private ResultadoInterpretacao processarResposta(String jsonResposta, ContextoIa contexto) {
        try {
            JsonNode root = json.readTree(jsonResposta);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty()) {
                throw new IllegalStateException("Resposta vazia da IA Gemini.");
            }
            JsonNode textNode = candidates.get(0).path("content").path("parts").get(0).path("text");
            String jsonTexto = textNode.asText();

            JsonNode parsed = json.readTree(jsonTexto);
            return DecodificadorDaProposta.decodificar(json, parsed, contexto);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decodificar a resposta do Gemini.");
        }
    }
}
