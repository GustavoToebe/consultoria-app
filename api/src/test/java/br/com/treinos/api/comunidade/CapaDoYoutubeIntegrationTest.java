package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.fotos.FotosDeTeste;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Usar a capa do YouTube" (C25) ponta a ponta: o cliente de rede é trocado por um que fala com um servidor de mentira do JDK
 * (nunca o YouTube de verdade); o resto da pilha é a de verdade. Cobre contrato, permissão, isolamento, teto diário (gasto
 * antes do download), 503 neutro e a regravação do JPEG sem metadados. Dados fictícios.
 */
@AutoConfigureMockMvc
@Import(CapaDoYoutubeIntegrationTest.YoutubeDeMentira.class)
class CapaDoYoutubeIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/comunidade/capas/youtube";
    private static final String SUCESSO = "sucesso0001";
    private static final String NAO_EXISTE = "falha404000";
    private static final String NAO_E_JPEG = "naoejpeg001";
    private static final String GRANDE = "grande00001";
    private static final String LENTO = "lento000001";
    private static final String REDIRECIONA = "redireciona";

    private static final List<String> PEDIDOS = new CopyOnWriteArrayList<>();
    private static final HttpServer SERVIDOR = subirServidor();

    /** Troca só o cliente de rede da capa do YouTube pelo que aponta para o servidor de mentira, com tempos curtos. */
    @TestConfiguration(proxyBeanMethods = false)
    static class YoutubeDeMentira {
        @Bean
        @Primary
        YoutubeCapaCliente youtubeDeMentira() {
            return new YoutubeCapaCliente("http://127.0.0.1:" + SERVIDOR.getAddress().getPort(), Duration.ofSeconds(2),
                    Duration.ofMillis(700));
        }
    }

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private LimiteTentativas limite;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode loginAluno;
    private UUID consultoria;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Ana Capa Fictícia");
        loginAluno = api.convidarEEntrar(admin, aluno);
        consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, aluno);
        PEDIDOS.clear();
    }

    private static HttpServer subirServidor() {
        try {
            HttpServer s = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            s.createContext("/", CapaDoYoutubeIntegrationTest::tratar);
            s.setExecutor(Executors.newCachedThreadPool());
            s.start();
            return s;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void tratar(HttpExchange troca) throws IOException {
        PEDIDOS.add(troca.getRequestURI().getRawPath());
        String[] partes = troca.getRequestURI().getPath().split("/");
        String id = partes.length > 2 ? partes[2] : "";
        switch (id) {
            case SUCESSO -> responder(troca, 200, "image/jpeg",
                    FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.RED, 300, false)));
            case NAO_E_JPEG -> responder(troca, 200, "image/jpeg", png());
            case GRANDE -> {
                troca.getResponseHeaders().add("Content-Type", "image/jpeg");
                troca.sendResponseHeaders(200, 0);
                try {
                    byte[] c = new byte[400_000];
                    c[0] = (byte) 0xFF;
                    c[1] = (byte) 0xD8;
                    c[2] = (byte) 0xFF;
                    troca.getResponseBody().write(c);
                } catch (IOException cortado) {
                    // o cliente abortou no limite: é o esperado
                }
                troca.close();
            }
            case LENTO -> {
                try {
                    Thread.sleep(2_500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                troca.close();
            }
            case REDIRECIONA -> {
                troca.getResponseHeaders().add("Location", "/alvo");
                troca.sendResponseHeaders(302, -1);
                troca.close();
            }
            default -> responder(troca, 404, "text/html", "nao".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
    }

    private static void responder(HttpExchange troca, int status, String tipo, byte[] corpo) throws IOException {
        troca.getResponseHeaders().add("Content-Type", tipo);
        troca.sendResponseHeaders(status, corpo.length);
        troca.getResponseBody().write(corpo);
        troca.close();
    }

    private static byte[] png() throws IOException {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(16, 16, BufferedImage.TYPE_INT_RGB), "png", saida);
        return saida.toByteArray();
    }

    private static String link(String id) {
        return "https://www.youtube.com/watch?v=" + id;
    }

    private JsonNode pedir(JsonNode login, String videoUrl, int esperado) throws Exception {
        return api.post(ROTA, login, Map.of("videoUrl", videoUrl), esperado);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro Fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private void gastarCota(int envios) {
        for (int i = 0; i < envios; i++) {
            assertThat(limite.capaDaComunidadeCabe(consultoria, CapasDaComunidadeService.POR_DIA)).isTrue();
        }
    }

    private byte[] ler(JsonNode login, String id) throws Exception {
        return mvc.perform(get("/comunidade/capas/" + id).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
    }

    @Test
    void sucessoGravaCapaPendenteComAMesmaFormaDoEnvioManualESemMetadados() throws Exception {
        JsonNode resposta = pedir(admin, link(SUCESSO), 200);

        assertThat(resposta.propertyNames()).containsExactly("id");
        String id = resposta.get("id").asString();
        // Só o id do vídeo, no caminho fixo, chegou ao "YouTube".
        assertThat(PEDIDOS).containsExactly("/vi/" + SUCESSO + "/hqdefault.jpg");
        assertThat(jdbc.queryForObject("select count(*) from comunidade_capa where id = ?::uuid and consultoria_id = ?",
                Integer.class, id, consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select aula_id is null and post_id is null from comunidade_capa where id = ?::uuid",
                Boolean.class, id)).isTrue();

        byte[] lidos = ler(admin, id);
        assertThat(lidos).isNotEmpty();
        assertThat(FotosDeTeste.contem(lidos, FotosDeTeste.MARCA_EXIF)).as("EXIF/comentário/IPTC").isFalse();
        assertThat(FotosDeTeste.contem(lidos, "Exif")).isFalse();
    }

    @Test
    void semPermissaoDaModeracaoEh403EAlunoTambemENadaSaiDoServidor() throws Exception {
        pedir(loginAluno, link(SUCESSO), 403);
        pedir(membro(Set.of("TREINO_LER")), link(SUCESSO), 403);
        api.post(ROTA, null, Map.of("videoUrl", link(SUCESSO)), 401);
        assertThat(PEDIDOS).isEmpty();
    }

    @Test
    void linkInvalidoEh422SemEcoSemRedeESemGastarCota() throws Exception {
        gastarCota(CapasDaComunidadeService.POR_DIA - 1);
        String[] ruins = {"https://youtu.be/dQw4w9WgXc", "https://youtu.be/dQw4w9WgXcQQ", "https://youtu.be/dQw4w9WgXc!",
                "https://evil.example/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "http://youtu.be/dQw4w9WgXcQ", "", "   "};
        for (String ruim : ruins) {
            JsonNode erro = pedir(admin, ruim, 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("CAPA_INVALIDA");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("videoUrl");
            if (!ruim.isBlank()) {
                assertThat(erro.toString()).doesNotContain(ruim);
            }
        }
        api.post(ROTA, admin, Map.of(), 422);
        assertThat(PEDIDOS).isEmpty();
        // A última vaga do dia continua livre: nenhum dos pedidos acima a gastou.
        pedir(admin, link(SUCESSO), 200);
    }

    @Test
    void falhasDeRedeTamanhoFormatoERedirecionamentoSao503NeutroSemDetalhe() throws Exception {
        for (String id : new String[] {NAO_EXISTE, NAO_E_JPEG, GRANDE, LENTO, REDIRECIONA}) {
            JsonNode erro = pedir(admin, link(id), 503);
            assertThat(erro.get("codigo").asString()).isEqualTo("CAPA_YOUTUBE_INDISPONIVEL");
            assertThat(erro.get("message").asString()).isEqualTo("Não foi possível buscar a capa agora. Tente enviar a imagem.");
            assertThat(erro.toString()).doesNotContain(id).doesNotContain("ytimg").doesNotContain("127.0.0.1");
        }
        assertThat(jdbc.queryForObject("select count(*) from comunidade_capa where consultoria_id = ?", Integer.class, consultoria))
                .isZero();
        // O redirecionamento não foi seguido: o servidor nunca viu o /alvo.
        assertThat(PEDIDOS).doesNotContain("/alvo");
    }

    @Test
    void tetoDiarioContaComOEnvioManualEGastaAntesDoDownload() throws Exception {
        gastarCota(CapasDaComunidadeService.POR_DIA - 2);

        // Falha de download gasta a vaga (decisão documentada: ela sai antes da rede).
        pedir(admin, link(NAO_EXISTE), 503);
        // A última vaga ainda dá certo...
        pedir(admin, link(SUCESSO), 200);
        PEDIDOS.clear();
        // ...e a seguinte bate no teto ANTES de qualquer chamada de saída.
        JsonNode cheio = pedir(admin, link(SUCESSO), 422);
        assertThat(cheio.get("codigo").asString()).isEqualTo("IMAGENS_LIMITE_DIARIO");
        assertThat(PEDIDOS).isEmpty();
    }

    @Test
    void outraConsultoriaTemOProprioTetoENaoVeACapa() throws Exception {
        gastarCota(CapasDaComunidadeService.POR_DIA);
        pedir(admin, link(SUCESSO), 422);

        JsonNode outro = api.novoTreinador();
        String idDeOutro = pedir(outro, link(SUCESSO), 200).get("id").asString();

        // Cada uma vê só a capa da própria consultoria (404 uniforme do filtro de tenant).
        mvc.perform(get("/comunidade/capas/" + idDeOutro).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin)))
                .andExpect(status().isNotFound());
        assertThat(ler(outro, idDeOutro)).isNotEmpty();
    }
}
