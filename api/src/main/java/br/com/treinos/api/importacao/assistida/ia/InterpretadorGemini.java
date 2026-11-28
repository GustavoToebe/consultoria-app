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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Conector para Google Gemini (padrão gemini-2.5-flash, {@code gemini-modelo}) usando HttpClient nativo do Java 25.
 * Envia SÓ o texto extraído (com CPF, e-mail, telefone e CEP desde 10/11/2026), sem PDF bruto nem nome de arquivo, e só quando o roteador libera
 * ({@code enviar-dados-ao-provedor}). A chave vai no cabeçalho, nunca na URL. A resposta segue o {@link EsquemaDaProposta}
 * ({@code responseSchema}).
 */
@Component
public class InterpretadorGemini implements InterpretadorIa {

    /**
     * O mesmo teto por chamada do Claude (o corte do arquivo e da sessão sai dele). O {@code generateContent} só responde
     * no fim, então 60 s quase nunca terminavam um documento grande; o "3 min até o primeiro byte" do Claude não se aplica
     * sem streaming.
     */
    // shortcut: sem streamGenerateContent (SSE), uma conexão parada só cai em 10 min; trocar se o Gemini virar o provedor principal.
    static final Duration TIMEOUT_HTTP = InterpretadorClaude.TIMEOUT_HTTP;

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
        return interpretarTrecho(contexto, DecodificadorDaProposta.textoParaEnvio(contexto));
    }

    @Override
    public ResultadoInterpretacao interpretarTrecho(ContextoIa contexto, String trecho) {
        String apiKey = config.getGeminiApiKey();
        if (apiKey.isBlank()) {
            throw new IllegalStateException("Chave da API Gemini não configurada.");
        }

        String modelo = config.getGeminiModelo();
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .timeout(TIMEOUT_HTTP)
                    .POST(HttpRequest.BodyPublishers.ofString(montarCorpo(contexto, trecho), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                throw FalhaPassageiraDoProvedor.doStatus("Gemini", response);
            }

            return processarResposta(response.body(), contexto, modelo);
        } catch (IllegalStateException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Consulta ao Gemini interrompida.");
        } catch (IOException e) {
            // Inclui o tempo esgotado (HttpTimeoutException) e a conexão que caiu.
            throw new FalhaPassageiraDoProvedor("Erro de rede ao consultar Google Gemini (" + e.getClass().getSimpleName() + ").");
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao consultar Google Gemini (" + e.getClass().getSimpleName() + ").");
        }
    }

    private String montarCorpo(ContextoIa contexto, String trecho) {
        Map<String, Object> req = new LinkedHashMap<>();

        // Prompt de Sistema com regras da metodologia e privacidade
        String promptSistema = "Você é o assistente de importação da plataforma Overtraining.\n"
                + "Extraia cadastros de alunos, pesos, planos de treino (divisões, exercícios, séries, repetições, descanso) "
                + "e planos de dieta (refeições, horários, alimentos com quantidade e unidade), mais suplementos e medicações.\n"
                + SOBRE_O_DOCUMENTO
                + DecodificadorDaProposta.trechoDeMetodologiaEBiblioteca(contexto)
                + "Dicionário de abreviações conhecidas da consultoria:\n" + DecodificadorDaProposta.formatarApelidos(contexto.apelidosConhecidos()) + "\n"
                + "Nunca invente dados inexistentes: se não houver repetição ou peso, deixe nulo.\n"
                + DecodificadorDaProposta.FORMATO_DA_RESPOSTA
                + "Responda só com o JSON do formato.";

        req.put("system_instruction", Map.of("parts", List.of(Map.of("text", promptSistema))));
        req.put("contents", List.of(Map.of("parts", List.of(Map.of("text", InterpretadorIa.emDocumento(trecho))))));
        req.put("generationConfig", Map.of("responseMimeType", "application/json",
                "responseSchema", paraGemini(EsquemaDaProposta.paraClaude())));

        return json.writeValueAsString(req);
    }

    /**
     * O mesmo esquema no formato do {@code responseSchema} (subconjunto da OpenAPI): {@code ["tipo","null"]} vira o tipo
     * com {@code nullable}, enum de número vira o tipo numérico (o Gemini só aceita enum de texto) e
     * {@code additionalProperties} sai. A ordem das propriedades vai em {@code propertyOrdering}.
     */
    static Object paraGemini(Object esquema) {
        if (!(esquema instanceof Map<?, ?> m)) {
            return esquema;
        }
        Map<String, Object> g = new LinkedHashMap<>();
        Object tipo = m.get("type");
        boolean anulavel = false;
        if (tipo instanceof List<?> tipos) {
            anulavel = tipos.contains("null");
            tipo = tipos.stream().filter(t -> !"null".equals(t)).findFirst().orElse(null);
        }
        if (m.get("enum") instanceof List<?> valores) {
            anulavel |= valores.contains(null);
            List<?> semNulo = valores.stream().filter(Objects::nonNull).toList();
            if (semNulo.stream().allMatch(String.class::isInstance)) {
                tipo = "string";
                g.put("format", "enum");
                g.put("enum", semNulo);
            } else {
                tipo = semNulo.stream().allMatch(v -> v instanceof Integer || v instanceof Long) ? "integer" : "number";
            }
        }
        if (tipo != null) {
            g.put("type", tipo.toString().toUpperCase(Locale.ROOT));
        }
        if (anulavel) {
            g.put("nullable", true);
        }
        if (m.get("properties") instanceof Map<?, ?> propriedades) {
            Map<String, Object> convertidas = new LinkedHashMap<>();
            propriedades.forEach((nome, valor) -> convertidas.put(nome.toString(), paraGemini(valor)));
            g.put("properties", convertidas);
            g.put("propertyOrdering", List.copyOf(convertidas.keySet()));
        }
        if (m.containsKey("items")) {
            g.put("items", paraGemini(m.get("items")));
        }
        if (m.get("required") instanceof List<?> obrigatorias && !obrigatorias.isEmpty()) {
            g.put("required", obrigatorias);
        }
        return g;
    }

    private ResultadoInterpretacao processarResposta(String jsonResposta, ContextoIa contexto, String modelo) {
        try {
            JsonNode root = json.readTree(jsonResposta);
            JsonNode candidates = root.path("candidates");
            if (candidates.isEmpty()) {
                throw new IllegalStateException("Resposta vazia da IA Gemini.");
            }
            String parada = candidates.get(0).path("finishReason").asText();
            if ("MAX_TOKENS".equals(parada)) {
                throw new DecodificadorDaProposta.RespostaCortada("Gemini");
            }
            StringBuilder texto = new StringBuilder();
            for (JsonNode parte : candidates.get(0).path("content").path("parts")) {
                if (!parte.path("thought").asBoolean(false)) {
                    texto.append(parte.path("text").asText());
                }
            }
            JsonNode u = root.path("usageMetadata");
            ResultadoInterpretacao.Uso uso = new ResultadoInterpretacao.Uso(root.path("modelVersion").asText(modelo), parada,
                    u.path("promptTokenCount").asLong(0),
                    u.path("candidatesTokenCount").asLong(0) + u.path("thoughtsTokenCount").asLong(0),
                    u.path("cachedContentTokenCount").asLong(0), 0);
            return DecodificadorDaProposta.decodificar(json, json.readTree(texto.toString()), contexto).comUso(uso);
        } catch (DecodificadorDaProposta.RespostaCortada e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decodificar a resposta do Gemini.");
        }
    }
}
