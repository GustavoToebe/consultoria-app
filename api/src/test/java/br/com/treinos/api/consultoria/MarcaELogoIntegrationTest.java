package br.com.treinos.api.consultoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import br.com.treinos.api.fotos.FotosDeTeste;

import java.awt.Color;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Seção 15.1, item 6 (logo pelos bytes) e a marca da consultoria. */
@AutoConfigureMockMvc
class MarcaELogoIntegrationTest extends AbstractIntegrationTest {

    private static final byte[] PNG = png(64, 64);

    /** Assinatura PNG + chunk IHDR com a largura e a altura pedidas (o servidor lê só o cabeçalho). */
    private static byte[] png(int largura, int altura) {
        java.nio.ByteBuffer b = java.nio.ByteBuffer.allocate(33);
        b.put(new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 0x1A, 10, 0, 0, 0, 13, 'I', 'H', 'D', 'R'});
        b.putInt(largura).putInt(altura).put(new byte[] {8, 6, 0, 0, 0}).putInt(0);
        return b.array();
    }
    private static final byte[] GIF = "GIF89a....".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
            .getBytes(StandardCharsets.UTF_8);

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void pngAceitoEServidoComTipoCertoECacheLongo() throws Exception {
        MvcResult r = enviar(new MockMultipartFile("arquivo", "logo.png", "image/png", PNG), 200);
        String logoUrl = api.ler(r).get("logoUrl").asString();
        assertThat(logoUrl).contains("/logo?v=1");

        mvc.perform(get(logoUrl))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("max-age")));

        api.delete("/consultoria/marca/logo", treinador, 200);
        mvc.perform(get(logoUrl)).andExpect(status().isNotFound()).andExpect(jsonPath("$.codigo").value("NAO_ENCONTRADO"));
    }

    @Test
    void svgGifMaiorQue512KiBETipoMentirosoSaoRecusados() throws Exception {
        enviar(new MockMultipartFile("arquivo", "logo.svg", "image/svg+xml", SVG), 400);
        // Declara JPEG, mas os bytes são GIF.
        MvcResult mentiroso = enviar(new MockMultipartFile("arquivo", "logo.jpg", "image/jpeg", GIF), 400);
        assertThat(api.ler(mentiroso).get("codigo").asString()).isEqualTo("ARQUIVO_INVALIDO");
        byte[] grande = new byte[512 * 1024 + 1];
        System.arraycopy(PNG, 0, grande, 0, PNG.length);
        enviar(new MockMultipartFile("arquivo", "grande.png", "image/png", grande), 400);
        assertThat(api.get("/consultoria", treinador, 200).get("marca").get("logoUrl").isNull()).isTrue();
    }

    @Test
    void pngTemOTamanhoConferidoNoCabecalho() throws Exception {
        enviar(new MockMultipartFile("arquivo", "logo.png", "image/png", png(2048, 2048)), 200);
        for (byte[] ruim : List.of(png(2049, 100), png(100, 2049), png(0, 100), png(100, 0), png(Integer.MIN_VALUE, 100),
                java.util.Arrays.copyOf(png(100, 100), 20))) {
            MvcResult r = enviar(new MockMultipartFile("arquivo", "logo.png", "image/png", ruim), 400);
            assertThat(api.ler(r).get("codigo").asString()).isEqualTo("ARQUIVO_INVALIDO");
        }
    }

    @Test
    void jpegPassaPelaLimpezaDeMetadadosETemOMesmoLimiteDeLado() throws Exception {
        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.RED));
        assertThat(FotosDeTeste.contem(suja, "Exif")).isTrue();
        String logoUrl = api.ler(enviar(new MockMultipartFile("arquivo", "logo.jpg", "image/jpeg", suja), 200)).get("logoUrl").asString();
        byte[] servida = mvc.perform(get(logoUrl)).andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/jpeg")).andReturn().getResponse().getContentAsByteArray();
        assertThat(FotosDeTeste.contem(servida, "Exif")).isFalse();
        assertThat(FotosDeTeste.contem(servida, FotosDeTeste.MARCA_EXIF)).isFalse();
        // Maior que 2048 px, cortado ao meio ou só o começo de um JPEG: recusa.
        enviar(new MockMultipartFile("arquivo", "grande.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.RED, 2100, false)), 400);
        byte[] inteira = FotosDeTeste.jpeg(Color.RED);
        enviar(new MockMultipartFile("arquivo", "cortada.jpg", "image/jpeg", java.util.Arrays.copyOf(inteira, inteira.length / 2)), 400);
        enviar(new MockMultipartFile("arquivo", "falsa.jpg", "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}), 400);
    }

    @Test
    void marcaComLockOtimistaEValidacao() throws Exception {
        JsonNode atual = api.get("/consultoria", treinador, 200);
        long versao = atual.get("versao").asLong();
        assertThat(atual.has("configuracao")).isFalse();

        JsonNode nova = api.put("/consultoria/marca", treinador, Map.of("nome", "SARAIVA TEAM", "corPrimaria", "#c62828",
                "fonteTitulo", "METAL", "temaPadrao", "ESCURO", "versao", versao), 200);
        assertThat(nova.get("marca").get("corPrimaria").asString()).isEqualTo("#C62828");
        assertThat(nova.get("marca").get("fonteTitulo").asString()).isEqualTo("METAL");
        // As quatro fontes do nome gravam e voltam; valor desconhecido é 400, não 500.
        for (String fonte : List.of("PADRAO", "ESPORTIVA", "CONDENSADA", "METAL")) {
            JsonNode salva = api.put("/consultoria/marca", treinador, Map.of("nome", "SARAIVA TEAM", "corPrimaria", "#C62828",
                    "fonteTitulo", fonte, "temaPadrao", "ESCURO", "versao", nova.get("versao").asLong()), 200);
            assertThat(salva.get("marca").get("fonteTitulo").asString()).isEqualTo(fonte);
            assertThat(api.get("/consultoria", treinador, 200).get("marca").get("fonteTitulo").asString()).isEqualTo(fonte);
            nova = salva;
        }
        api.put("/consultoria/marca", treinador, Map.of("nome", "Fonte inexistente", "corPrimaria", "#C62828",
                "fonteTitulo", "COMIC", "temaPadrao", "ESCURO", "versao", nova.get("versao").asLong()), 400);
        api.put("/consultoria/marca", treinador, Map.of("nome", "Outra aba", "corPrimaria", "#000000",
                "fonteTitulo", "PADRAO", "temaPadrao", "CLARO", "versao", versao), 409);
        api.put("/consultoria/marca", treinador, Map.of("nome", "Cor inválida", "corPrimaria", "vermelho",
                "fonteTitulo", "PADRAO", "temaPadrao", "CLARO", "versao", nova.get("versao").asLong()), 400);
    }

    private MvcResult enviar(MockMultipartFile arquivo, int esperado) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, "/consultoria/marca/logo").file(arquivo)
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andExpect(status().is(esperado))
                .andReturn();
    }
}
