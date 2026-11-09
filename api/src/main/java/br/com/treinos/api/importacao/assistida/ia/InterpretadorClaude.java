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
 * Conector para Anthropic Claude (claude-sonnet-4-5 e claude-haiku-4-5) usando HttpClient nativo do Java 25.
 * Envia SÓ o texto redigido (LGPD), sem PDF bruto nem nome de arquivo, e só quando o roteador libera
 * ({@code enviar-dados-ao-provedor}). Extrai a estrutura via tool calling.
 */
@Component
public class InterpretadorClaude implements InterpretadorIa {

    private final ConfiguracaoIaImportacao config;
    private final JsonMapper json;
    private final HttpClient http;

    public InterpretadorClaude(ConfiguracaoIaImportacao config, JsonMapper json) {
        this.config = config;
        this.json = json;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Override
    public String nomeProvedor() {
        return "claude";
    }

    @Override
    public ResultadoInterpretacao interpretar(ContextoIa contexto) {
        String apiKey = config.getClaudeApiKey();
        if (apiKey.isBlank()) {
            throw new IllegalStateException("Chave da API Claude não configurada.");
        }

        String modelo = "claude-sonnet-4-5";
        String url = "https://api.anthropic.com/v1/messages";

        try {
            String corpoRequisicao = montarCorpo(contexto, modelo);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(corpoRequisicao, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                // Corpo da resposta fora da mensagem: pode ecoar o conteúdo enviado.
                throw new IllegalStateException("Falha na chamada Claude (HTTP " + response.statusCode() + ").");
            }

            return processarResposta(response.body(), contexto);
        } catch (IllegalStateException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Consulta ao Claude interrompida.");
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao consultar Anthropic Claude (" + e.getClass().getSimpleName() + ").");
        }
    }

    private String montarCorpo(ContextoIa contexto, String modelo) throws Exception {
        Map<String, Object> req = new java.util.HashMap<>();
        req.put("model", modelo);
        req.put("max_tokens", 4096);

        String systemPrompt = "Você é o assistente de importação da plataforma Overtraining.\n"
                + "Extraia cadastros de alunos, evolução de peso, treinos e dietas.\n"
                + "Metodologia: séries válidas: " + String.join(", ", contexto.metodosConsultoria()) + ".\n"
                + "Apelidos da consultoria: " + DecodificadorDaProposta.formatarApelidos(contexto.apelidosConhecidos()) + ".\n"
                + "Sempre acione a ferramenta 'propor_importacao'.";
        req.put("system", systemPrompt);

        List<Map<String, Object>> contentList = List.of(
                Map.of("type", "text", "text", DecodificadorDaProposta.textoParaEnvio(contexto)));

        req.put("messages", List.of(Map.of("role", "user", "content", contentList)));

        // Configuração de tool calling
        Map<String, Object> tool = Map.of(
                "name", "propor_importacao",
                "description", "Retorna a proposta estruturada de importação com grupos e dúvidas",
                "input_schema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "grupos", Map.of("type", "array"),
                                "duvidas", Map.of("type", "array")
                        ),
                        "required", List.of("grupos", "duvidas")
                )
        );
        req.put("tools", List.of(tool));
        req.put("tool_choice", Map.of("type", "tool", "name", "propor_importacao"));

        return json.writeValueAsString(req);
    }

    private ResultadoInterpretacao processarResposta(String jsonResposta, ContextoIa contexto) {
        try {
            JsonNode root = json.readTree(jsonResposta);
            JsonNode content = root.path("content");
            JsonNode toolUse = null;
            if (content.isArray()) {
                for (JsonNode c : content) {
                    if ("tool_use".equals(c.path("type").asText()) && "propor_importacao".equals(c.path("name").asText())) {
                        toolUse = c.path("input");
                        break;
                    }
                }
            }

            if (toolUse == null) {
                throw new IllegalStateException("Claude não retornou chamada de ferramenta propor_importacao.");
            }

            return DecodificadorDaProposta.decodificar(json, toolUse, contexto);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decodificar a resposta do Claude.");
        }
    }
}
