package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.fotos.FotosManutencao;
import br.com.treinos.api.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reações por código (D4) e capa do vídeo (D7) do aulão e do post VIDEO: contagens sem identidade, idempotência, permissões,
 * 404 e ciclo de vida da capa (pendente, troca, remoção, exclusão, moderação, teto diário). Dados fictícios.
 */
@AutoConfigureMockMvc
class ComunidadeReacoesECapasIntegrationTest extends AbstractIntegrationTest {

    private static final String ALUNO = "/aluno/comunidade/mural";
    private static final String EQUIPE = "/comunidade/mural";
    private static final String VIDEO = "https://exemplo.test/video";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private LimiteTentativas limite;
    @Autowired
    private FotosManutencao manutencao;
    @Autowired
    private ComunidadeMuralReacaoRepository reacoes;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode loginA;
    private JsonNode loginB;
    private UUID consultoria;
    private UUID usuarioA;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        UUID alunoA = api.criarAluno(admin, "Ana Reação Fictícia");
        UUID alunoB = api.criarAluno(admin, "Beto Reação Fictício");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
        consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, alunoA);
        usuarioA = jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, alunoA);
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

    private String postDeConversa() throws Exception {
        return api.post(ALUNO, loginA, Map.of("texto", "Conversa fictícia"), 200).get("id").asString();
    }

    private JsonNode noMural(JsonNode login, String id) throws Exception {
        for (JsonNode p : api.get(ALUNO, login, 200).get("content")) {
            if (p.get("id").asString().equals(id)) {
                return p;
            }
        }
        throw new AssertionError("O post deveria estar no mural.");
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private static List<String> lista(JsonNode no) {
        return no.valueStream().map(JsonNode::asString).toList();
    }

    // ---- reações ----

    @Test
    void reacoesPorCodigoSaoIdempotentesContamESoMostramAsMinhas() throws Exception {
        String post = postDeConversa();

        api.put(ALUNO + "/" + post + "/reacoes/FOGO", loginA, Map.of(), 204);
        api.put(ALUNO + "/" + post + "/reacoes/FOGO", loginA, Map.of(), 204);
        api.put(ALUNO + "/" + post + "/reacoes/CURTIR", loginA, Map.of(), 204);
        api.put(ALUNO + "/" + post + "/reacoes/FOGO", loginB, Map.of(), 204);
        api.put(EQUIPE + "/" + post + "/reacoes/PALMAS", admin, Map.of(), 204);

        JsonNode paraA = noMural(loginA, post);
        assertThat(paraA.get("reacoes").get("FOGO").asLong()).isEqualTo(2);
        assertThat(paraA.get("reacoes").get("CURTIR").asLong()).isEqualTo(1);
        assertThat(paraA.get("reacoes").get("PALMAS").asLong()).isEqualTo(1);
        // As minhas vêm na ordem do enum e sem a de ninguém mais; o JSON não traz quem reagiu.
        assertThat(lista(paraA.get("minhasReacoes"))).containsExactly("CURTIR", "FOGO");
        assertThat(lista(noMural(loginB, post).get("minhasReacoes"))).containsExactly("FOGO");
        assertThat(paraA.toString()).doesNotContain("Beto").doesNotContain("usuarioId");

        api.delete(ALUNO + "/" + post + "/reacoes/FOGO", loginA, 204);
        api.delete(ALUNO + "/" + post + "/reacoes/FOGO", loginA, 204);
        JsonNode depois = noMural(loginA, post);
        assertThat(depois.get("reacoes").get("FOGO").asLong()).isEqualTo(1);
        assertThat(lista(depois.get("minhasReacoes"))).containsExactly("CURTIR");
        assertThat(contar("select count(*) from comunidade_mural_reacao where post_id = ?::uuid", post)).isEqualTo(3);
    }

    @Test
    void reacaoRecusadaPorCodigoPermissaoEIsolamento() throws Exception {
        String post = postDeConversa();
        JsonNode semModerar = membro(Set.of("TREINO_LER"));

        for (String ruim : List.of("fogo", "XYZ", "CURTIRR")) {
            JsonNode erro = api.put(ALUNO + "/" + post + "/reacoes/" + ruim, loginA, Map.of(), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("REACAO_INVALIDA");
            api.delete(ALUNO + "/" + post + "/reacoes/" + ruim, loginA, 422);
        }
        api.put(EQUIPE + "/" + post + "/reacoes/FOGO", semModerar, Map.of(), 403);
        api.put(EQUIPE + "/" + post + "/reacoes/FOGO", loginA, Map.of(), 403);
        api.put(ALUNO + "/" + post + "/reacoes/FOGO", admin, Map.of(), 403);
        api.put(ALUNO + "/" + post + "/reacoes/FOGO", null, Map.of(), 401);

        // Outra consultoria, post oculto e post inexistente = 404.
        JsonNode outro = api.novoTreinador();
        JsonNode alunoDeFora = api.convidarEEntrar(outro, api.criarAluno(outro, "Aluno de fora fictício"));
        api.put(ALUNO + "/" + post + "/reacoes/FOGO", alunoDeFora, Map.of(), 404);
        api.put(ALUNO + "/" + UUID.randomUUID() + "/reacoes/FOGO", loginA, Map.of(), 404);
        api.delete(EQUIPE + "/" + post, admin, 204);
        api.put(ALUNO + "/" + post + "/reacoes/FOGO", loginA, Map.of(), 404);
        assertThat(contar("select count(*) from comunidade_mural_reacao where post_id = ?::uuid", post)).isZero();
    }

    @Test
    void putsSimultaneosDaMesmaReacaoGravamUmaLinhaPorCodigoSemErro() throws Exception {
        String post = postDeConversa();
        List<String> codigos = List.of("FOGO", "CURTIR", "PALMAS");
        ExecutorService pool = Executors.newFixedThreadPool(2 * codigos.size());
        CountDownLatch largada = new CountDownLatch(1);
        try {
            List<Future<Integer>> futuros = new ArrayList<>();
            for (String codigo : codigos) {
                for (int toque = 0; toque < 2; toque++) {
                    Callable<Integer> tocar = () -> {
                        largada.await();
                        return mvc.perform(put(ALUNO + "/" + post + "/reacoes/" + codigo)
                                        .header("X-Treinos-Cliente", "nativo")
                                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA))
                                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                                .andReturn().getResponse().getStatus();
                    };
                    futuros.add(pool.submit(tocar));
                }
            }
            largada.countDown();
            for (Future<Integer> f : futuros) {
                assertThat(f.get(60, TimeUnit.SECONDS)).isEqualTo(204);
            }
        } finally {
            pool.shutdownNow();
        }
        for (String codigo : codigos) {
            assertThat(contar("select count(*) from comunidade_mural_reacao where post_id = ?::uuid and codigo = ?", post, codigo))
                    .isEqualTo(1);
        }
        assertThat(contar("select count(*) from comunidade_mural_reacao where post_id = ?::uuid", post)).isEqualTo(codigos.size());
    }

    @Test
    void chaveUnicaDaReacaoRecusaATuplaRepetidaPeloNomeDaRestricao() throws Exception {
        UUID post = UUID.fromString(postDeConversa());
        try {
            TenantContext.executarComo(consultoria, () -> reacoes.saveAndFlush(new ComunidadeMuralReacao(post, usuarioA, "FOGO")));

            // A mesma tupla (post, usuário, código) de novo, gravada direto: é a chave única que o serviço procura (V065/V068).
            assertThatExceptionOfType(DataIntegrityViolationException.class)
                    .isThrownBy(() -> TenantContext.executarComo(consultoria,
                            () -> reacoes.saveAndFlush(new ComunidadeMuralReacao(post, usuarioA, "FOGO"))))
                    .satisfies(e -> assertThat(ReacoesDoMuralService.violouIndiceUnico(e)).isTrue());
        } finally {
            jdbc.update("delete from comunidade_mural_reacao where post_id = ?", post);
        }
    }

    // ---- capas ----

    private JsonNode enviarCapa(JsonNode login, byte[] bytes, int esperado) throws Exception {
        MvcResult r = mvc.perform(multipart("/comunidade/capas").file(new MockMultipartFile("arquivo", "capa.jpg", "image/jpeg", bytes))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andExpect(status().is(esperado)).andReturn();
        String corpo = r.getResponse().getContentAsString();
        return corpo.isEmpty() ? null : json.readTree(corpo);
    }

    private String novaCapa() throws Exception {
        return enviarCapa(admin, FotosDeTeste.jpeg(Color.RED, 300, false), 200).get("id").asString();
    }

    private Map<String, Object> corpoDeAula(String capaId) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("titulo", "Aulão fictício " + UUID.randomUUID());
        c.put("videoUrl", VIDEO);
        c.put("publicada", true);
        c.put("capaId", capaId);
        return c;
    }

    private Map<String, Object> corpoDeVideo(String capaId) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("tipo", "VIDEO");
        c.put("texto", "Vídeo fictício");
        c.put("videoUrl", VIDEO);
        c.put("capaId", capaId);
        return c;
    }

    private int bytesDaCapa(JsonNode login, String rota, String id, int esperado) throws Exception {
        MvcResult r = mvc.perform(get(rota + "/capas/" + id).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
        if (esperado == 200) {
            assertThat(r.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        }
        return r.getResponse().getContentAsByteArray().length;
    }

    @Test
    void capaDoAulaoPendenteLigadaTrocadaRemovidaEApagadaComOAulao() throws Exception {
        String primeira = novaCapa();
        // Pendente: a equipe vê (prévia), o aluno não.
        assertThat(bytesDaCapa(admin, "/comunidade", primeira, 200)).isPositive();
        bytesDaCapa(loginA, "/aluno/comunidade", primeira, 404);

        JsonNode aula = api.post("/comunidade/aulas", admin, corpoDeAula(primeira), 200);
        String id = aula.get("id").asString();
        assertThat(aula.get("capaId").asString()).isEqualTo(primeira);
        assertThat(bytesDaCapa(loginA, "/aluno/comunidade", primeira, 200)).isPositive();

        // Trocar apaga a anterior; a mesma de novo não muda nada.
        String segunda = novaCapa();
        assertThat(api.put("/comunidade/aulas/" + id, admin, corpoDeAula(segunda), 200).get("capaId").asString()).isEqualTo(segunda);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", primeira)).isZero();
        api.put("/comunidade/aulas/" + id, admin, corpoDeAula(segunda), 200);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", segunda)).isEqualTo(1);

        // Sem capaId remove; capa que já tem dono (de outro aulão) ou inexistente = 422 no campo capaId, e nada muda.
        String terceira = novaCapa();
        api.post("/comunidade/aulas", admin, corpoDeAula(terceira), 200);
        JsonNode jaTemDono = api.put("/comunidade/aulas/" + id, admin, corpoDeAula(terceira), 422);
        assertThat(jaTemDono.get("fieldErrors").get(0).get("field").asString()).isEqualTo("capaId");
        api.put("/comunidade/aulas/" + id, admin, corpoDeAula(UUID.randomUUID().toString()), 422);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", segunda)).isEqualTo(1);
        assertThat(api.put("/comunidade/aulas/" + id, admin, corpoDeAula(null), 200).get("capaId").isNull()).isTrue();
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", segunda)).isZero();

        // Excluir o aulão apaga a capa (cascata).
        String ultima = novaCapa();
        String comCapa = api.post("/comunidade/aulas", admin, corpoDeAula(ultima), 200).get("id").asString();
        api.delete("/comunidade/aulas/" + comCapa, admin, 204);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", ultima)).isZero();
    }

    @Test
    void capaDeAulaoDespublicadoDa404AoAlunoMasNaoAEquipe() throws Exception {
        String capa = novaCapa();
        Map<String, Object> corpo = corpoDeAula(capa);
        corpo.put("publicada", false);
        api.post("/comunidade/aulas", admin, corpo, 200);

        bytesDaCapa(loginA, "/aluno/comunidade", capa, 404);
        assertThat(bytesDaCapa(admin, "/comunidade", capa, 200)).isPositive();
    }

    @Test
    void capaDoPostDeVideoValeSoNoVideoEAcompanhaAModeracao() throws Exception {
        String capa = novaCapa();
        JsonNode video = api.post(EQUIPE, admin, corpoDeVideo(capa), 200);
        assertThat(video.get("capaId").asString()).isEqualTo(capa);
        assertThat(noMural(loginA, video.get("id").asString()).get("capaId").asString()).isEqualTo(capa);
        assertThat(bytesDaCapa(loginA, "/aluno/comunidade", capa, 200)).isPositive();

        // Capa em post que não é vídeo, ou já com dono, ou de outra consultoria/inexistente = 422 no campo capaId.
        Map<String, Object> aviso = new LinkedHashMap<>(Map.of("tipo", "AVISO", "texto", "Aviso fictício"));
        aviso.put("capaId", novaCapa());
        assertThat(api.post(EQUIPE, admin, aviso, 422).get("fieldErrors").get(0).get("field").asString()).isEqualTo("capaId");
        assertThat(api.post(EQUIPE, admin, corpoDeVideo(capa), 422).get("fieldErrors").get(0).get("field").asString())
                .isEqualTo("capaId");
        api.post(EQUIPE, admin, corpoDeVideo(UUID.randomUUID().toString()), 422);
        JsonNode outro = api.novoTreinador();
        String deFora = enviarCapa(outro, FotosDeTeste.jpeg(Color.GREEN, 300, false), 200).get("id").asString();
        api.post(EQUIPE, admin, corpoDeVideo(deFora), 422);
        bytesDaCapa(admin, "/comunidade", deFora, 404);

        // Vídeo sem capa continua valendo; moderar o post apaga a capa e o aluno passa a ver 404.
        assertThat(api.post(EQUIPE, admin, corpoDeVideo(null), 200).get("capaId").isNull()).isTrue();
        api.delete(EQUIPE + "/" + video.get("id").asString(), admin, 204);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", capa)).isZero();
        bytesDaCapa(loginA, "/aluno/comunidade", capa, 404);
    }

    @Test
    void manutencaoApagaACapaPendenteComMaisDe24HSemNenhumEnvioNovo() throws Exception {
        String antiga = novaCapa();
        String recente = novaCapa();
        String doAulao = novaCapa();
        api.post("/comunidade/aulas", admin, corpoDeAula(doAulao), 200);
        String doPost = novaCapa();
        api.post(EQUIPE, admin, corpoDeVideo(doPost), 200);
        JsonNode outro = api.novoTreinador();
        String deFora = enviarCapa(outro, FotosDeTeste.jpeg(Color.GREEN, 300, false), 200).get("id").asString();
        String recenteDeFora = enviarCapa(outro, FotosDeTeste.jpeg(Color.BLUE, 300, false), 200).get("id").asString();
        jdbc.update("update comunidade_capa set criado_em = now() - interval '25 hours' where id in (?::uuid, ?::uuid)", antiga, deFora);
        jdbc.update("update comunidade_capa set criado_em = now() - interval '23 hours' where id = ?::uuid", recente);
        jdbc.update("update comunidade_capa set criado_em = now() - interval '72 hours' where id in (?::uuid, ?::uuid)", doAulao, doPost);

        // Nenhum envio novo: só a rotina de manutenção (a mesma que o agendador chama). Ela vê todas as consultorias,
        // então a pendente vencida de fora também sai; as novas (inclusive a de fora) e as ligadas ficam.
        assertThat(manutencao.limparCapasPendentesDaComunidade()).isGreaterThanOrEqualTo(2);

        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", antiga)).isZero();
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", deFora)).isZero();
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", recente)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", recenteDeFora)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", doAulao)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", doPost)).isEqualTo(1);
        manutencao.limparCapasPendentesDaComunidade();
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", recente)).isEqualTo(1);
    }

    @Test
    void envioDeCapaRecusaArquivoRuimPermissaoETetoDiario() throws Exception {
        enviarCapa(loginA, FotosDeTeste.jpeg(Color.RED, 300, false), 403);
        enviarCapa(membro(Set.of("TREINO_LER")), FotosDeTeste.jpeg(Color.RED, 300, false), 403);
        JsonNode texto = enviarCapa(admin, "isto não é uma imagem".getBytes(java.nio.charset.StandardCharsets.UTF_8), 422);
        assertThat(texto.get("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        // PNG de verdade (decodificável) também não vale: a capa é só JPEG.
        assertThat(enviarCapa(admin, pngReal(), 422).get("codigo").asString()).isEqualTo("FOTO_INVALIDA");

        // Pendente com mais de 24 h sai no próximo envio (a limpeza não devolve cota: são 2 envios gastos até aqui).
        String velha = novaCapa();
        jdbc.update("update comunidade_capa set criado_em = now() - interval '25 hours' where id = ?::uuid", velha);
        novaCapa();
        assertThat(contar("select count(*) from comunidade_capa where id = ?::uuid", velha)).isZero();

        // O teto é de 100 por consultoria em 24 h, no contador. O arquivo recusado e o 403 acima não gastaram cota: sobram
        // exatamente 98 vagas, e o envio seguinte (o 101º) leva 422.
        gastarCota(CapasDaComunidadeService.POR_DIA - 2);
        JsonNode cheio = enviarCapa(admin, FotosDeTeste.jpeg(Color.RED, 300, false), 422);
        assertThat(cheio.get("codigo").asString()).isEqualTo("IMAGENS_LIMITE_DIARIO");
    }

    private static byte[] pngReal() throws IOException {
        BufferedImage imagem = new BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = imagem.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, 32, 32);
        g.dispose();
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        ImageIO.write(imagem, "png", saida);
        return saida.toByteArray();
    }

    private static boolean temMarcador(byte[] jpeg, int marcador) {
        for (int i = 0; i + 1 < jpeg.length; i++) {
            if ((jpeg[i] & 0xFF) == 0xFF && (jpeg[i + 1] & 0xFF) == marcador) {
                return true;
            }
        }
        return false;
    }

    @Test
    void capaEnviadaComExifEComentarioSaiSemEles() throws Exception {
        byte[] comMetadados = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.RED, 300, false));
        assertThat(temMarcador(comMetadados, 0xFE)).isTrue();
        assertThat(FotosDeTeste.contem(comMetadados, FotosDeTeste.MARCA_EXIF)).isTrue();

        String id = enviarCapa(admin, comMetadados, 200).get("id").asString();
        byte[] lidos = mvc.perform(get("/comunidade/capas/" + id).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();

        assertThat(lidos).isNotEmpty();
        assertThat(temMarcador(lidos, 0xFE)).as("comentário COM (0xFFFE)").isFalse();
        assertThat(FotosDeTeste.contem(lidos, FotosDeTeste.MARCA_EXIF)).isFalse();
    }

    /** Gasta {@code envios} vagas do contador da consultoria do teste (cada teste tem a sua), como os uploads gastariam. */
    private void gastarCota(int envios) {
        for (int i = 0; i < envios; i++) {
            assertThat(limite.capaDaComunidadeCabe(consultoria, CapasDaComunidadeService.POR_DIA))
                    .as("vaga %d de %d", i + 1, envios).isTrue();
        }
    }

    @Test
    void apagarCapaNaoDevolveACota() throws Exception {
        gastarCota(CapasDaComunidadeService.POR_DIA - 3);

        // Três envios (as 3 últimas vagas): trocar e remover a capa do aulão, e ocultar o post de vídeo, apagam as três linhas.
        String primeira = novaCapa();
        String aula = api.post("/comunidade/aulas", admin, corpoDeAula(primeira), 200).get("id").asString();
        String segunda = novaCapa();
        api.put("/comunidade/aulas/" + aula, admin, corpoDeAula(segunda), 200);
        api.put("/comunidade/aulas/" + aula, admin, corpoDeAula(null), 200);
        String terceira = novaCapa();
        String video = api.post(EQUIPE, admin, corpoDeVideo(terceira), 200).get("id").asString();
        api.delete(EQUIPE + "/" + video, admin, 204);
        assertThat(contar("select count(*) from comunidade_capa where consultoria_id = ?", consultoria)).isZero();

        // Nada vivo, mas a cota segue gasta: o próximo envio é o 101º.
        JsonNode cheio = enviarCapa(admin, FotosDeTeste.jpeg(Color.RED, 300, false), 422);
        assertThat(cheio.get("codigo").asString()).isEqualTo("IMAGENS_LIMITE_DIARIO");
        assertThat(contar("select count(*) from comunidade_capa where consultoria_id = ?", consultoria)).isZero();
    }

    @Test
    void cotaDeCapasEPorConsultoria() throws Exception {
        gastarCota(CapasDaComunidadeService.POR_DIA);
        enviarCapa(admin, FotosDeTeste.jpeg(Color.RED, 300, false), 422);

        // Outra consultoria tem o contador dela.
        JsonNode outro = api.novoTreinador();
        enviarCapa(outro, FotosDeTeste.jpeg(Color.GREEN, 300, false), 200);
    }

    private record Envio(int status, String codigo) { }

    private Envio enviarCapaSemConferir(JsonNode login, byte[] bytes) throws Exception {
        MvcResult r = mvc.perform(multipart("/comunidade/capas").file(new MockMultipartFile("arquivo", "capa.jpg", "image/jpeg", bytes))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andReturn();
        String corpo = r.getResponse().getContentAsString();
        return new Envio(r.getResponse().getStatus(), corpo.isEmpty() ? null : json.readTree(corpo).path("codigo").asString());
    }

    @Test
    void enviosSimultaneosNaoPassamDasVagasQueRestam() throws Exception {
        int vagas = 2;
        int tentativas = 5;
        gastarCota(CapasDaComunidadeService.POR_DIA - vagas);
        byte[] jpeg = FotosDeTeste.jpeg(Color.RED, 300, false);

        ExecutorService pool = Executors.newFixedThreadPool(tentativas);
        CountDownLatch largada = new CountDownLatch(1);
        List<Envio> envios = new ArrayList<>();
        try {
            List<Future<Envio>> futuros = new ArrayList<>();
            for (int i = 0; i < tentativas; i++) {
                Callable<Envio> enviar = () -> {
                    largada.await();
                    return enviarCapaSemConferir(admin, jpeg);
                };
                futuros.add(pool.submit(enviar));
            }
            largada.countDown();
            for (Future<Envio> f : futuros) {
                envios.add(f.get(60, TimeUnit.SECONDS));
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(envios.stream().filter(e -> e.status() == 200).count()).isEqualTo(vagas);
        List<Envio> recusados = envios.stream().filter(e -> e.status() != 200).toList();
        assertThat(recusados).hasSize(tentativas - vagas).allSatisfy(e -> {
            assertThat(e.status()).isEqualTo(422);
            assertThat(e.codigo()).isEqualTo("IMAGENS_LIMITE_DIARIO");
        });
        assertThat(contar("select count(*) from comunidade_capa where consultoria_id = ?", consultoria)).isEqualTo(vagas);
    }
}
