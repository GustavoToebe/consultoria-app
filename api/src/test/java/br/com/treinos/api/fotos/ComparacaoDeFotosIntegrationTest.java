package br.com.treinos.api.fotos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Comparação de fotos: linha do tempo, autorização e JPEG no servidor. Só quadrados coloridos. */
@AutoConfigureMockMvc
class ComparacaoDeFotosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @MockitoSpyBean private ArmazenamentoDeFotos bucket;

    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode loginAluno;
    private UUID aluno;
    private String pasta;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Fotos");
        loginAluno = api.convidarEEntrar(treinador, aluno);
        pasta = publicarPasta(LocalDate.now(Fuso.BRASILIA));
    }

    @Test
    void linhaDoTempoPesoIsolamentoEImagem() throws Exception {
        AnamneseEnviada anamnese = anamneseComFoto();
        String fotoAnamnese = anamnese.foto();
        String fotoCostas = anamnese.outra();
        banco.update("update anamnese set enviada_em = now() - interval '10 days' where id = ?::uuid", anamnese.id());

        UUID azul = subir(FotosDeTeste.jpeg(Color.BLUE));
        UUID verde = subir(FotosDeTeste.jpeg(Color.GREEN));
        UUID extra = subir(FotosDeTeste.jpeg(Color.YELLOW));
        UUID pendente = subir(FotosDeTeste.jpeg(Color.MAGENTA));
        JsonNode enviada = enviar(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6,
                "fotos", List.of(azul.toString(), verde.toString(), extra.toString())), 200);
        banco.update("update atualizacao_foto set removida_em = now() where id = ?::uuid", extra);

        JsonNode linha = api.get("/alunos/" + aluno + "/fotos", treinador, 200);
        assertThat(linha).hasSize(4);
        assertThat(linha.get(0).path("origem").asString()).isEqualTo("ANAMNESE");
        assertThat(linha.get(0).path("fotoId").asString()).isEqualTo(fotoAnamnese);
        assertThat(linha.get(0).path("posicao").asString()).isEqualTo("Foto de costas");
        assertThat(linha.get(0).path("pesoKg").isNull()).isTrue();
        assertThat(linha.get(1).path("origem").asString()).isEqualTo("ANAMNESE");
        assertThat(linha.get(1).path("fotoId").asString()).isEqualTo(fotoCostas);
        assertThat(linha.get(2).path("origem").asString()).isEqualTo("ATUALIZACAO");
        assertThat(linha.get(2).path("origemId").asString()).isEqualTo(enviada.path("id").asString());
        assertThat(linha.get(2).path("posicao").asString()).isEqualTo("Fotos em jejum");
        assertThat(linha.get(2).path("ordem").asInt()).isZero();
        assertThat(linha.get(2).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(linha.get(3).path("ordem").asInt()).isEqualTo(1);
        assertThat(linha.valueStream().map(n -> n.path("fotoId").asString())).doesNotContain(pendente.toString(), extra.toString());

        JsonNode doAluno = api.get("/aluno/fotos/linha-do-tempo", loginAluno, 200);
        assertThat(doAluno).hasSize(4);
        JsonNode outra = api.novoTreinador();
        api.get("/alunos/" + aluno + "/fotos", outra, 404);

        MvcResult semAutorizacao = comparar(List.of(azul, verde), false, 409);
        assertThat(api.ler(semAutorizacao).path("codigo").asString()).isEqualTo("USO_DE_IMAGEM_NAO_AUTORIZADO");

        JsonNode autorizado = api.put("/aluno/uso-de-imagem", loginAluno, Map.of("autorizado", true), 200);
        assertThat(autorizado.path("autorizadoEm").isNull()).isFalse();
        api.put("/aluno/uso-de-imagem", loginAluno, Map.of("autorizado", true), 200);
        assertThat(contagem("USO_DE_IMAGEM_AUTORIZADO")).isEqualTo(1);
        assertThat(api.get("/alunos/" + aluno + "/exportacao", treinador, 200).path("cadastro").path("usoDeImagemAutorizadoEm").isNull()).isFalse();
        MvcResult semLogo = comparar(List.of(azul, verde), true, 422);
        assertThat(api.ler(semLogo).path("codigo").asString()).isEqualTo("SEM_LOGO");

        MvcResult jpeg = comparar(List.of(azul, verde), false, 200);
        assertThat(jpeg.getResponse().getContentType()).isEqualTo("image/jpeg");
        assertThat(jpeg.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(jpeg.getResponse().getHeader("Content-Disposition")).contains("stories.jpg");
        byte[] bytes = jpeg.getResponse().getContentAsByteArray();
        assertThat(JpegSemMetadados.temMetadados(bytes)).isFalse();
        BufferedImage imagem = ImageIO.read(new ByteArrayInputStream(bytes));
        assertThat(imagem.getWidth()).isEqualTo(1080);
        assertThat(imagem.getHeight()).isEqualTo(1920);

        enviarLogo();
        MvcResult comLogo = comparar(List.of(azul, verde), true, 200);
        BufferedImage marcada = ImageIO.read(new ByteArrayInputStream(comLogo.getResponse().getContentAsByteArray()));
        var layout = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.STORIES, 2, true, 20, 20);
        int px = marcada.getRGB(layout.logo().x() + layout.logo().largura() / 2, layout.logo().y() + layout.logo().altura() / 2);
        assertThat((px >> 16) & 0xFF).isGreaterThan(150);
        assertThat(px & 0xFF).isLessThan(80);

        MvcResult ambos = postar(List.of(Map.of("fotoIds", List.of(azul, verde))), "AMBOS", false, 200);
        assertThat(ambos.getResponse().getContentType()).isEqualTo("application/zip");
        assertThat(ambos.getResponse().getHeader("Content-Disposition")).contains("comparacao.zip");
        Map<String, byte[]> pacote = lerZip(ambos.getResponse().getContentAsByteArray());
        assertThat(pacote).containsOnlyKeys("Stories/01-fotos-em-jejum.jpg", "Feed/01-fotos-em-jejum.jpg");
        assertThat(JpegSemMetadados.temMetadados(pacote.get("Stories/01-fotos-em-jejum.jpg"))).isFalse();
        assertThat(ImageIO.read(new ByteArrayInputStream(pacote.get("Stories/01-fotos-em-jejum.jpg"))).getHeight()).isEqualTo(1920);
        assertThat(ImageIO.read(new ByteArrayInputStream(pacote.get("Feed/01-fotos-em-jejum.jpg"))).getHeight()).isEqualTo(1350);

        MvcResult pares = postar(List.of(
                Map.of("fotoIds", List.of(azul, verde)),
                Map.of("fotoIds", List.of(UUID.fromString(fotoAnamnese), UUID.fromString(fotoCostas)))), "FEED", false, 200);
        Map<String, byte[]> varias = lerZip(pares.getResponse().getContentAsByteArray());
        assertThat(varias).containsOnlyKeys("Feed/01-fotos-em-jejum.jpg", "Feed/02-costas.jpg");
        BufferedImage costas = ImageIO.read(new ByteArrayInputStream(varias.get("Feed/02-costas.jpg")));
        assertThat(costas.getWidth()).isEqualTo(1080);
        assertThat(costas.getHeight()).isEqualTo(1350);
        var lugares = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.FEED, 2, false, 0, 0).fotos();
        int esquerda = costas.getRGB(lugares.get(0).x() + lugares.get(0).largura() / 2, 8);
        int direita = costas.getRGB(lugares.get(1).x() + lugares.get(1).largura() / 2, 8);
        assertThat((esquerda >> 16) & 0xFF).isLessThan(80);
        assertThat(esquerda & 0xFF).isGreaterThan(150);
        assertThat((direita >> 16) & 0xFF).isGreaterThan(150);
        assertThat(direita & 0xFF).isLessThan(80);
        postar(List.of(Map.of("fotoIds", List.of(azul, verde)), Map.of("fotoIds", List.of(azul))), "STORIES", false, 400);

        MvcResult tres = comparar(List.of(azul, verde, UUID.fromString(fotoAnamnese)), false, 200);
        BufferedImage larga = ImageIO.read(new ByteArrayInputStream(tres.getResponse().getContentAsByteArray()));
        assertThat(larga.getWidth()).isEqualTo(1080);
        assertThat(larga.getHeight()).isEqualTo(1920);

        assertThat(contagem("COMPARACAO_DE_FOTOS_GERADA")).isEqualTo(5);
        assertThat(banco.queryForObject(
                "select count(*) from auditoria where acao = 'COMPARACAO_DE_FOTOS_GERADA' and entidade_id = ?::uuid and resumo = ?",
                Integer.class, aluno, ComparacaoDeFotosService.RESUMO_GERADA)).isEqualTo(5);
        comparar(List.of(azul, pendente), false, 404);
        comparar(List.of(azul), false, 400);
        comparar(List.of(azul, verde, extra), false, 404);
        comparar(List.of(azul, verde, azul, verde, extra), false, 400);

        api.put("/aluno/uso-de-imagem", loginAluno, Map.of("autorizado", false), 200);
        assertThat(api.get("/aluno/uso-de-imagem", loginAluno, 200).path("autorizadoEm").isNull()).isTrue();
        comparar(List.of(azul, verde), false, 409);
        assertThat(contagem("USO_DE_IMAGEM_REVOGADO")).isEqualTo(1);
        api.put("/aluno/uso-de-imagem", treinador, Map.of("autorizado", true), 403);

        api.put("/aluno/uso-de-imagem", loginAluno, Map.of("autorizado", true), 200);
        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício Fotos"), 200);
        assertThat(banco.queryForObject("select uso_de_imagem_autorizado_em from aluno where id = ?::uuid", Object.class, aluno)).isNull();
    }

    @Test
    void limiteContaTambemAsTentativasQueFalham() throws Exception {
        List<UUID> inexistentes = List.of(UUID.randomUUID(), UUID.randomUUID());
        // 30 recusadas por falta de autorização do aluno (409) e 30 por foto inexistente (404): todas contam.
        for (int i = 0; i < 30; i++) {
            comparar(inexistentes, false, 409);
        }
        api.put("/aluno/uso-de-imagem", loginAluno, Map.of("autorizado", true), 200);
        for (int i = 0; i < 30; i++) {
            comparar(inexistentes, false, 404);
        }
        MvcResult limitada = comparar(inexistentes, false, 429);
        assertThat(limitada.getResponse().getHeader("Retry-After")).isNotNull();
    }

    @Test
    void bancoNaoFicaAbertoEnquantoAFotoEBaixadaDoBucket() throws Exception {
        UUID[] fotos = autorizarEEnviarFotos(2);
        List<Boolean> transacaoAtiva = new CopyOnWriteArrayList<>();
        doAnswer(chamada -> {
            transacaoAtiva.add(TransactionSynchronizationManager.isActualTransactionActive());
            return chamada.callRealMethod();
        }).when(bucket).ler(anyString());

        postar(List.of(Map.of("fotoIds", List.of(fotos[0], fotos[1]))), "AMBOS", false, 200);

        assertThat(transacaoAtiva).isNotEmpty().doesNotContain(true);
    }

    @Test
    void auditoriaSoSaiQuandoAImagemFoiGerada() throws Exception {
        UUID[] fotos = autorizarEEnviarFotos(2);
        doThrow(new NaoEncontradoException("Foto não encontrada.")).when(bucket).ler(anyString());
        comparar(List.of(fotos[0], fotos[1]), false, 404);
        assertThat(contagem("COMPARACAO_DE_FOTOS_GERADA")).isZero();

        reset(bucket);
        comparar(List.of(fotos[0], fotos[1]), false, 200);
        assertThat(contagem("COMPARACAO_DE_FOTOS_GERADA")).isEqualTo(1);
    }

    @Test
    void cadaFotoELidaEDecodificadaUmaVezMesmoComOsDoisFormatos() throws Exception {
        UUID[] fotos = autorizarEEnviarFotos(4);
        clearInvocations(bucket);

        MvcResult ambos = postar(List.of(Map.of("fotoIds", List.of(fotos[0], fotos[1])),
                Map.of("fotoIds", List.of(fotos[2], fotos[3]))), "AMBOS", false, 200);

        verify(bucket, times(4)).ler(anyString());
        assertThat(lerZip(ambos.getResponse().getContentAsByteArray())).containsOnlyKeys(
                "Stories/01-fotos-em-jejum.jpg", "Stories/02-fotos-em-jejum.jpg",
                "Feed/01-fotos-em-jejum.jpg", "Feed/02-fotos-em-jejum.jpg");
    }

    @Test
    void fotosDaAnamneseSoComAnamneseLer() throws Exception {
        AnamneseEnviada anamnese = anamneseComFoto();
        UUID deAnamnese = UUID.fromString(anamnese.foto());
        UUID[] fotos = autorizarEEnviarFotos(2);

        var semAnamnese = CatalogoPermissoes.comDependencias(Set.of("ATUALIZACAO_LER", "ALUNO_SENSIVEL_LER"));
        assertThat(semAnamnese).doesNotContain("ANAMNESE_LER");
        JsonNode soAtualizacao = membro(semAnamnese);
        JsonNode comAnamnese = membro(CatalogoPermissoes.comDependencias(
                Set.of("ATUALIZACAO_LER", "ALUNO_SENSIVEL_LER", "ANAMNESE_LER")));

        JsonNode linhaSem = api.get("/alunos/" + aluno + "/fotos", soAtualizacao, 200);
        assertThat(linhaSem).hasSize(2);
        assertThat(linhaSem.valueStream().map(n -> n.path("origem").asString())).containsOnly("ATUALIZACAO");
        assertThat(api.get("/alunos/" + aluno + "/fotos", comAnamnese, 200)).hasSize(4);
        assertThat(api.get("/alunos/" + aluno + "/fotos", treinador, 200)).hasSize(4);

        // Sem a permissão a foto da anamnese é "não encontrada", como foto de outro aluno: não revela que existe.
        postarComo(soAtualizacao, List.of(Map.of("fotoIds", List.of(fotos[0], deAnamnese))), "STORIES", 404);
        postarComo(soAtualizacao, List.of(Map.of("fotoIds", List.of(fotos[0], fotos[1]))), "STORIES", 200);
        postarComo(comAnamnese, List.of(Map.of("fotoIds", List.of(fotos[0], deAnamnese))), "STORIES", 200);
        // O aluno continua vendo as próprias fotos de anamnese.
        assertThat(api.get("/aluno/fotos/linha-do-tempo", loginAluno, 200)).hasSize(4);
    }

    /** Sobe as fotos (uma cor para cada), envia a atualização com elas e liga a autorização de uso do aluno. */
    private UUID[] autorizarEEnviarFotos(int quantidade) throws Exception {
        Color[] cores = {Color.BLUE, Color.GREEN, Color.YELLOW, Color.MAGENTA, Color.PINK, Color.GRAY};
        UUID[] ids = new UUID[quantidade];
        for (int i = 0; i < quantidade; i++) {
            ids[i] = subir(FotosDeTeste.jpeg(cores[i]));
        }
        enviar(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6,
                "fotos", java.util.Arrays.stream(ids).map(UUID::toString).toList()), 200);
        api.put("/aluno/uso-de-imagem", loginAluno, Map.of("autorizado", true), 200);
        return ids;
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private int contagem(String acao) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class, acao, aluno);
    }

    private MvcResult comparar(List<UUID> ids, boolean comLogo, int esperado) throws Exception {
        return postar(List.of(Map.of("fotoIds", ids)), "STORIES", comLogo, esperado);
    }

    private MvcResult postar(List<Map<String, Object>> imagens, String formato, boolean comLogo, int esperado) throws Exception {
        return postarComo(treinador, imagens, formato, comLogo, esperado);
    }

    private MvcResult postarComo(JsonNode login, List<Map<String, Object>> imagens, String formato, int esperado) throws Exception {
        return postarComo(login, imagens, formato, false, esperado);
    }

    private MvcResult postarComo(JsonNode login, List<Map<String, Object>> imagens, String formato, boolean comLogo,
                                 int esperado) throws Exception {
        return mvc.perform(post("/alunos/" + aluno + "/fotos/comparacao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("formato", formato, "comLogo", comLogo, "imagens", imagens)))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private static Map<String, byte[]> lerZip(byte[] bytes) throws Exception {
        Map<String, byte[]> entradas = new LinkedHashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            var entrada = zip.getNextEntry();
            while (entrada != null) {
                entradas.put(entrada.getName(), zip.readAllBytes());
                entrada = zip.getNextEntry();
            }
        }
        return entradas;
    }

    private void enviarLogo() throws Exception {
        BufferedImage png = new BufferedImage(20, 20, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = png.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 20, 20);
        g.dispose();
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        ImageIO.write(png, "png", saida);
        mvc.perform(multipart(HttpMethod.PUT, "/consultoria/marca/logo")
                        .file(new MockMultipartFile("arquivo", "logo.png", "image/png", saida.toByteArray()))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andExpect(status().isOk());
    }

    private String publicarPasta(LocalDate fim) throws Exception {
        String nova = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", nova), 200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        return nova;
    }

    private UUID subir(byte[] bytes) throws Exception {
        MvcResult r = mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "q.jpg", "image/jpeg", bytes))
                        .param("pastaId", pasta)
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isOk()).andReturn();
        return UUID.fromString(api.ler(r).path("id").asString());
    }

    private JsonNode enviar(Map<String, Object> respostas, int esperado) throws Exception {
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        return api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", atual.path("pastaId").asString(),
                "questionarioVersaoId", atual.path("questionarioVersaoId").asString(), "respostas", respostas), esperado);
    }

    private record AnamneseEnviada(String id, String foto, String outra) {
    }

    private AnamneseEnviada anamneseComFoto() throws Exception {
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", "Com fotos", "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Com fotos");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "A",
                "perguntas", List.of(Map.of("id", "fotos", "tipo", "FOTOS", "rotulo", "Foto de costas", "obrigatoria", true, "max", 2))))));
        corpo.put("versao", q.path("versao").asLong());
        JsonNode salvo = api.put("/questionarios/" + q.path("id").asString(), treinador, corpo, 200);
        JsonNode publicado = api.post("/questionarios/" + q.path("id").asString() + "/publicar", treinador,
                Map.of("versao", salvo.path("versao").asLong(), "confirmarAvisos", true), 200);
        JsonNode a = api.post("/alunos/" + aluno + "/anamneses", treinador, Map.of("questionarioId", publicado.path("id").asString()), 200);
        MvcResult r = mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "q.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.CYAN)))
                        .param("anamneseId", a.path("id").asString())
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isOk()).andReturn();
        String foto = api.ler(r).path("id").asString();
        MvcResult segunda = mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "q.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.ORANGE)))
                        .param("anamneseId", a.path("id").asString())
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isOk()).andReturn();
        String outra = api.ler(segunda).path("id").asString();
        api.post("/aluno/anamnese/" + a.path("id").asString() + "/enviar", loginAluno,
                Map.of("questionarioVersaoId", a.path("questionarioVersaoId").asString(), "respostas", Map.of("fotos", List.of(foto, outra))), 200);
        return new AnamneseEnviada(a.path("id").asString(), foto, outra);
    }
}
