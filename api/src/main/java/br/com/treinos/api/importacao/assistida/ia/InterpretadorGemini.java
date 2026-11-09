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
 * Conector para Google Gemini (gemini-2.5-flash e gemini-2.5-pro) usando HttpClient nativo do Java 25.
 * Envia o texto pré-redigido (LGPD) ou bytes de PDF em base64 com saída estruturada JSON.
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
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent?key=" + apiKey;

        try {
            String corpoRequisicao = montarCorpo(contexto);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(corpoRequisicao, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                throw new RuntimeException("Falha na chamada Gemini (HTTP " + response.statusCode() + "): " + response.body());
            }

            return processarResposta(response.body(), contexto);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao consultar Google Gemini: " + e.getMessage(), e);
        }
    }

    private String montarCorpo(ContextoIa contexto) throws Exception {
        Map<String, Object> req = new java.util.HashMap<>();

        // Prompt de Sistema com regras da metodologia e privacidade
        String promptSistema = "Você é o assistente de importação da plataforma Overtraining.\n"
                + "Extraia cadastros de alunos, pesos, planos de treino (divisões, exercícios, séries, repetições, descanso) "
                + "e planos de dieta (refeições, horários, alimentos com quantidade e unidade).\n"
                + "Metodologia da consultoria: tipos de séries permitidos: " + String.join(", ", contexto.metodosConsultoria()) + ".\n"
                + "Dicionário de abreviações conhecidas da consultoria:\n" + formatarApelidos(contexto.apelidosConhecidos()) + "\n"
                + "Nunca invente dados inexistentes: se não houver repetição ou peso, deixe nulo.\n"
                + "Responda OBRIGATORIAMENTE em JSON no formato especificado.";

        Map<String, Object> systemInstruction = Map.of(
                "parts", List.of(Map.of("text", promptSistema))
        );
        req.put("system_instruction", systemInstruction);

        List<Map<String, Object>> parts = new ArrayList<>();
        if (contexto.pdfBytesSeHouver() != null && contexto.pdfBytesSeHouver().length > 0) {
            String base64Pdf = Base64.getEncoder().encodeToString(contexto.pdfBytesSeHouver());
            parts.add(Map.of("inline_data", Map.of("mime_type", "application/pdf", "data", base64Pdf)));
            parts.add(Map.of("text", "Analise este documento PDF completo e extraia a estrutura de treino/dieta/aluno."));
        } else {
            StringBuilder sb = new StringBuilder("Arquivo: ").append(contexto.nomeArquivo()).append("\n\n");
            for (BlocoTexto b : contexto.blocos()) {
                sb.append("--- ").append(b.titulo()).append(" ---\n").append(b.conteudo()).append("\n\n");
            }
            parts.add(Map.of("text", sb.toString()));
        }

        req.put("contents", List.of(Map.of("parts", parts)));
        req.put("generationConfig", Map.of("responseMimeType", "application/json"));

        return json.writeValueAsString(req);
    }

    private String formatarApelidos(Map<String, String> apelidos) {
        if (apelidos == null || apelidos.isEmpty()) return "Nenhum";
        StringBuilder sb = new StringBuilder();
        apelidos.forEach((k, v) -> sb.append("- '").append(k).append("' -> '").append(v).append("'\n"));
        return sb.toString();
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
            return decodificarEstrutura(parsed, contexto);
        } catch (Exception e) {
            throw new RuntimeException("Falha ao decodificar JSON retornado pelo Gemini: " + e.getMessage(), e);
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
