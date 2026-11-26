package br.com.treinos.api.importacao.assistida.ia;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Conector para Anthropic Claude (padrão claude-haiku-5-5, esforço configurável) usando HttpClient nativo do Java 25.
 * Envia SÓ o texto extraído (com CPF, e-mail, telefone e CEP desde 10/11/2026), sem PDF bruto nem nome de arquivo, e só quando o roteador libera
 * ({@code enviar-dados-ao-provedor}). Extrai a estrutura via tool calling.
 */
@Component
public class InterpretadorClaude implements InterpretadorIa {

    /** 32000 tokens de saída sem streaming passam de 2 min no pior caso. */
    static final String NOME_DA_FERRAMENTA = "propor_importacao";
    static final Duration TIMEOUT_HTTP = Duration.ofMinutes(5);

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

        String modelo = config.getClaudeModelo();
        String url = "https://api.anthropic.com/v1/messages";

        try {
            String corpoRequisicao = montarCorpo(contexto, modelo);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .timeout(TIMEOUT_HTTP)
                    .POST(HttpRequest.BodyPublishers.ofString(corpoRequisicao, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                // Corpo da resposta fora da mensagem: pode ecoar o conteúdo enviado.
                String falha = "Falha na chamada Claude (HTTP " + response.statusCode() + ").";
                throw FalhaPassageiraDoProvedor.statusPassageiro(response.statusCode())
                        ? new FalhaPassageiraDoProvedor(falha) : new IllegalStateException(falha);
            }

            return processarResposta(response.body(), contexto);
        } catch (IllegalStateException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Consulta ao Claude interrompida.");
        } catch (IOException e) {
            // Inclui o tempo esgotado (HttpTimeoutException) e a conexão que caiu.
            throw new FalhaPassageiraDoProvedor("Erro de rede ao consultar Anthropic Claude (" + e.getClass().getSimpleName() + ").");
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao consultar Anthropic Claude (" + e.getClass().getSimpleName() + ").");
        }
    }

    private String montarCorpo(ContextoIa contexto, String modelo) throws Exception {
        Map<String, Object> req = new java.util.HashMap<>();
        req.put("model", modelo);
        // O raciocínio (adaptativo, ligado por padrão) conta dentro do max_tokens. O Haiku 5.5 aceita até 128K de saída
        // (skill claude-api, 25/11/2026); 32000 dá folga a planos longos sem exigir streaming.
        req.put("max_tokens", 32000);
        req.put("output_config", Map.of("effort", config.getClaudeEsforco()));

        String systemPrompt = "Você é o assistente de importação da plataforma Overtraining.\n"
                + "Extraia cadastros de alunos, evolução de peso, treinos, dietas, suplementos e medicações.\n"
                + DecodificadorDaProposta.trechoDeMetodologiaEBiblioteca(contexto)
                + "Apelidos da consultoria: " + DecodificadorDaProposta.formatarApelidos(contexto.apelidosConhecidos()) + ".\n"
                + DecodificadorDaProposta.FORMATO_DA_RESPOSTA
                + "Sempre acione a ferramenta 'propor_importacao'.";
        // Tudo que vai antes do texto do arquivo (ferramenta + este bloco) é igual em todos os arquivos da sessão:
        // o cache_control no fim do system guarda esse prefixo (ephemeral, 5 min; mínimo de 512 tokens no Haiku 5.5).
        req.put("system", List.of(Map.of("type", "text", "text", systemPrompt,
                "cache_control", Map.of("type", "ephemeral"))));

        List<Map<String, Object>> contentList = List.of(
                Map.of("type", "text", "text", DecodificadorDaProposta.textoParaEnvio(contexto)));

        req.put("messages", List.of(Map.of("role", "user", "content", contentList)));

        Map<String, Object> tool = Map.of(
                "name", NOME_DA_FERRAMENTA,
                "description", "Retorna a proposta de importação: um grupo por aluno",
                "input_schema", EsquemaDaProposta.paraClaude());
        req.put("tools", List.of(tool));
        // O Haiku 5.5 aceita forçar a ferramenta (e então não raciocina antes de chamá-la: menos tempo e custo). Outros
        // modelos configurados podem recusar tool_choice forçado (400), então ficam em "auto" e o prompt pede a ferramenta.
        req.put("tool_choice", modelo.contains("haiku") ? Map.of("type", "tool", "name", NOME_DA_FERRAMENTA)
                : Map.of("type", "auto"));

        return json.writeValueAsString(req);
    }

    private ResultadoInterpretacao processarResposta(String jsonResposta, ContextoIa contexto) {
        try {
            JsonNode root = json.readTree(jsonResposta);
            String parada = root.path("stop_reason").asText();
            if ("max_tokens".equals(parada)) {
                // A ferramenta viria incompleta: o roteador volta às regras com o motivo RESPOSTA_CORTADA.
                throw new DecodificadorDaProposta.RespostaCortada("Claude");
            }
            if ("refusal".equals(parada)) {
                throw new IllegalStateException("Claude não concluiu a resposta (" + parada + ").");
            }
            JsonNode content = root.path("content");
            JsonNode toolUse = null;
            if (content.isArray()) {
                for (JsonNode c : content) {
                    if ("tool_use".equals(c.path("type").asText()) && NOME_DA_FERRAMENTA.equals(c.path("name").asText())) {
                        toolUse = c.path("input");
                        break;
                    }
                }
            }

            if (toolUse == null) {
                throw new IllegalStateException("Claude não retornou chamada de ferramenta propor_importacao.");
            }

            return DecodificadorDaProposta.decodificar(json, toolUse, contexto);
        } catch (DecodificadorDaProposta.RespostaCortada e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decodificar a resposta do Claude.");
        }
    }
}
