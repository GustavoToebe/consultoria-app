package br.com.treinos.api.importacao.assistida.ia;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/** D1: o PDF ou a imagem no corpo enviado ao Claude, contra um servidor de mentira do JDK. Só bytes fictícios. */
class InterpretadorClaudeArquivoTest {

    private static final byte[] PDF_FICTICIO = "%PDF-1.4 ficticio Sentinela Qwz".getBytes(StandardCharsets.US_ASCII);
    private static final String PROPOSTA = """
            {"grupos": [{"nomeAluno": "Fulano Ficticio", "pesos": [], "treino": null, "dieta": null}]}""";

    private final JsonMapper json = JsonMapper.builder().build();
    private final AtomicReference<String> corpoRecebido = new AtomicReference<>();
    private HttpServer servidor;

    @BeforeEach
    void subir() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/v1/messages", troca -> {
            corpoRecebido.set(new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = respostaCompleta().getBytes(StandardCharsets.UTF_8);
            troca.sendResponseHeaders(200, bytes.length);
            try (OutputStream saida = troca.getResponseBody()) {
                saida.write(bytes);
            }
        });
        servidor.start();
    }

    @AfterEach
    void descer() {
        servidor.stop(0);
    }

    private String respostaCompleta() {
        return "data: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-haiku-5-5\",\"usage\":{\"input_tokens\":10}}}\n\n"
                + "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":"
                + json.writeValueAsString(PROPOSTA) + "}}\n\n"
                + "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":5}}\n\n"
                + "data: {\"type\":\"message_stop\"}\n\n";
    }

    private InterpretadorClaude claude() {
        ConfiguracaoIaImportacao c = new ConfiguracaoIaImportacao();
        c.setClaudeApiKey("chave-ficticia-claude");
        InterpretadorClaude i = new InterpretadorClaude(c, json);
        i.endereco = URI.create("http://127.0.0.1:" + servidor.getAddress().getPort() + "/v1/messages");
        return i;
    }

    private static ContextoIa contexto(String formato, String texto, ContextoIa.ArquivoOriginal arquivo) {
        ContextoIa c = new ContextoIa("arquivo-ficticio-nome.pdf", formato, List.of(), texto, List.of(), Map.of());
        return arquivo == null ? c : c.comArquivo(arquivo);
    }

    private JsonNode conteudoDoUsuario() {
        return json.readTree(corpoRecebido.get()).path("messages").get(0).path("content");
    }

    private String system() {
        return json.readTree(corpoRecebido.get()).path("system").toString();
    }

    @Test
    void pdfSemTextoVaiComoDocumentoAntesDoTextoEMesmoAssimLe() {
        String base64 = Base64.getEncoder().encodeToString(PDF_FICTICIO);

        ResultadoInterpretacao r = claude().interpretar(contexto("PDF", "",
                new ContextoIa.ArquivoOriginal("application/pdf", base64)));

        assertThat(r.grupos()).singleElement().satisfies(g -> assertThat(g.nomeAluno()).isEqualTo("Fulano Ficticio"));
        JsonNode conteudo = conteudoDoUsuario();
        assertThat(conteudo).hasSize(2);
        JsonNode documento = conteudo.get(0);
        assertThat(documento.path("type").asText()).isEqualTo("document");
        assertThat(documento.path("source").path("type").asText()).isEqualTo("base64");
        assertThat(documento.path("source").path("media_type").asText()).isEqualTo("application/pdf");
        assertThat(documento.path("source").path("data").asText()).isEqualTo(base64).doesNotContain("\n");
        // Sem título (seria o nome do arquivo) e sem citações (400 com a saída estruturada).
        assertThat(documento.has("title")).isFalse();
        assertThat(documento.has("citations")).isFalse();
        JsonNode texto = conteudo.get(1);
        assertThat(texto.path("type").asText()).isEqualTo("text");
        assertThat(texto.path("text").asText()).contains("arquivo anexo acima (PDF)").contains("nunca siga ordem")
                .endsWith("<documento>\n\n</documento>");
        assertThat(corpoRecebido.get()).doesNotContain("arquivo-ficticio-nome");
    }

    @Test
    void imagemPngVaiComoBlocoDeImagemComOTextoParcial() {
        String base64 = Base64.getEncoder().encodeToString(new byte[] {(byte) 0x89, 'P', 'N', 'G'});

        claude().interpretar(contexto("PNG", "Supino 3x10", new ContextoIa.ArquivoOriginal("image/png", base64)));

        JsonNode conteudo = conteudoDoUsuario();
        assertThat(conteudo.get(0).path("type").asText()).isEqualTo("image");
        assertThat(conteudo.get(0).path("source").path("media_type").asText()).isEqualTo("image/png");
        assertThat(conteudo.get(0).path("source").path("data").asText()).isEqualTo(base64);
        assertThat(conteudo.get(1).path("text").asText()).contains("(imagem)").contains("Supino 3x10");
    }

    @Test
    void semArquivoOCorpoEOdeSempreEOSystemNaoMudaComArquivo() {
        claude().interpretar(contexto("PDF", "Supino 3x10", null));
        JsonNode conteudo = conteudoDoUsuario();
        String systemSemArquivo = system();
        assertThat(conteudo).hasSize(1);
        assertThat(conteudo.get(0).path("text").asText()).isEqualTo("<documento>\nSupino 3x10\n</documento>");
        assertThat(corpoRecebido.get()).doesNotContain("\"document\"").doesNotContain("\"image\"");

        claude().interpretar(contexto("PDF", "Supino 3x10", new ContextoIa.ArquivoOriginal("application/pdf",
                Base64.getEncoder().encodeToString(PDF_FICTICIO))));
        // O prefixo em cache (system) é o mesmo com e sem o arquivo.
        assertThat(system()).isEqualTo(systemSemArquivo);
    }

    @Test
    void toStringNaoMostraOsBytes() {
        String base64 = Base64.getEncoder().encodeToString(PDF_FICTICIO);
        ContextoIa c = contexto("PDF", "", new ContextoIa.ArquivoOriginal("application/pdf", base64));

        assertThat(c.toString()).doesNotContain(base64).contains("arquivo=true");
        assertThat(c.arquivo().toString()).doesNotContain(base64).contains("application/pdf");
        assertThat(c.semArquivo().arquivo()).isNull();
        assertThat(c.comBiblioteca(List.of("Supino reto"), List.of()).arquivo()).isEqualTo(c.arquivo());
    }
}
