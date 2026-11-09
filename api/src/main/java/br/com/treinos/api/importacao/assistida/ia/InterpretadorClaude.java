package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.assistida.BlocoTexto;
import br.com.treinos.api.treino.ConteudoTreino;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Conector para Anthropic Claude (claude-sonnet-4-5 e claude-haiku-4-5) usando HttpClient nativo do Java 25.
 * Envia texto ou bloco document base64 (PDF) e extrai a estrutura via tool calling.
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
                throw new RuntimeException("Falha na chamada Claude (HTTP " + response.statusCode() + "): " + response.body());
            }

            return processarResposta(response.body(), contexto);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao consultar Anthropic Claude: " + e.getMessage(), e);
        }
    }

    private String montarCorpo(ContextoIa contexto, String modelo) throws Exception {
        Map<String, Object> req = new java.util.HashMap<>();
        req.put("model", modelo);
        req.put("max_tokens", 4096);

        String systemPrompt = "Você é o assistente de importação da plataforma Overtraining.\n"
                + "Extraia cadastros de alunos, evolução de peso, treinos e dietas.\n"
                + "Metodologia: séries válidas: " + String.join(", ", contexto.metodosConsultoria()) + ".\n"
                + "Apelidos da consultoria: " + contexto.apelidosConhecidos() + ".\n"
                + "Sempre acione a ferramenta 'propor_importacao'.";
        req.put("system", systemPrompt);

        List<Map<String, Object>> contentList = new ArrayList<>();
        if (contexto.pdfBytesSeHouver() != null && contexto.pdfBytesSeHouver().length > 0) {
            String base64Pdf = Base64.getEncoder().encodeToString(contexto.pdfBytesSeHouver());
            contentList.add(Map.of(
                    "type", "document",
                    "source", Map.of(
                            "type", "base64",
                            "media_type", "application/pdf",
                            "data", base64Pdf
                    )
            ));
            contentList.add(Map.of("type", "text", "text", "Extraia os dados deste documento."));
        } else {
            StringBuilder sb = new StringBuilder("Arquivo: ").append(contexto.nomeArquivo()).append("\n\n");
            for (BlocoTexto b : contexto.blocos()) {
                sb.append("--- ").append(b.titulo()).append(" ---\n").append(b.conteudo()).append("\n\n");
            }
            contentList.add(Map.of("type", "text", "text", sb.toString()));
        }

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

            return decodificarEstrutura(toolUse, contexto);
        } catch (Exception e) {
            throw new RuntimeException("Falha ao decodificar resposta do Claude: " + e.getMessage(), e);
        }
    }

    private ResultadoInterpretacao decodificarEstrutura(JsonNode root, ContextoIa contexto) {
        List<ResultadoInterpretacao.PropostaGrupo> grupos = new ArrayList<>();
        List<ResultadoInterpretacao.PropostaDuvida> duvidas = new ArrayList<>();

        JsonNode gruposNode = root.path("grupos");
        if (gruposNode.isArray()) {
            for (JsonNode g : gruposNode) {
                String nome = g.path("nomeAluno").asText(contexto.nomeArquivo());
                String email = g.path("email").isNull() ? null : g.path("email").asText();
                String telefone = g.path("telefone").isNull() ? null : g.path("telefone").asText();
                String objetivo = g.path("objetivo").isNull() ? null : g.path("objetivo").asText();
                String observacoes = g.path("observacoes").isNull() ? null : g.path("observacoes").asText();

                List<ResultadoInterpretacao.PropostaPeso> pesos = new ArrayList<>();
                JsonNode pesosNode = g.path("pesos");
                if (pesosNode.isArray()) {
                    for (JsonNode p : pesosNode) {
                        try {
                            LocalDate data = p.has("data") ? LocalDate.parse(p.path("data").asText()) : LocalDate.now(ZoneId.systemDefault());
                            BigDecimal kg = new BigDecimal(p.path("kg").asText("70"));
                            pesos.add(new ResultadoInterpretacao.PropostaPeso(data, kg, p.path("observacao").asText(null)));
                        } catch (Exception ignored) {
                            // Ignora peso mal formatado
                        }
                    }
                }

                ConteudoTreino treino = null;
                if (g.has("treino") && !g.path("treino").isNull()) {
                    try {
                        treino = json.treeToValue(g.path("treino"), ConteudoTreino.class);
                    } catch (Exception ignored) {
                        // Ignora treino estruturado com falha de parsing
                    }
                }

                ConteudoDieta dieta = null;
                if (g.has("dieta") && !g.path("dieta").isNull()) {
                    try {
                        dieta = json.treeToValue(g.path("dieta"), ConteudoDieta.class);
                    } catch (Exception ignored) {
                        // Ignora dieta estruturada com falha de parsing
                    }
                }

                grupos.add(new ResultadoInterpretacao.PropostaGrupo(
                        contexto.nomeArquivo(), nome, email, telefone, objetivo, observacoes,
                        List.copyOf(pesos), treino, dieta
                ));
            }
        }

        JsonNode duvidasNode = root.path("duvidas");
        if (duvidasNode.isArray()) {
            for (JsonNode d : duvidasNode) {
                String tipo = d.path("tipo").asText("EXERCICIO_NAO_RECONHECIDO");
                String termo = d.path("termoOriginal").asText("");
                String trecho = d.path("trechoOriginal").asText("");

                List<ResultadoInterpretacao.PropostaSugestao> sugestoes = new ArrayList<>();
                JsonNode sugsNode = d.path("sugestoes");
                if (sugsNode.isArray()) {
                    for (JsonNode s : sugsNode) {
                        sugestoes.add(new ResultadoInterpretacao.PropostaSugestao(
                                s.path("termo").asText(), s.path("nota").asDouble(0.8)
                        ));
                    }
                }

                duvidas.add(new ResultadoInterpretacao.PropostaDuvida(tipo, termo, trecho, contexto.nomeArquivo(),
                        List.copyOf(sugestoes)));
            }
        }

        return new ResultadoInterpretacao(List.copyOf(grupos), List.copyOf(duvidas));
    }
}
