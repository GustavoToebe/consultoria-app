package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Comunidade organizada (V071): tipos por papel, aviso fixado e ordem, vídeo, busca e filtro, dúvida respondida pela equipe,
 * fotos (idade, chaves, limites, ligação atômica, isolamento), denúncia, chaves do treinador, exportação e anonimização.
 * Cada teste cria a própria consultoria; só dados fictícios.
 */
@AutoConfigureMockMvc
class ComunidadeOrganizadaIntegrationTest extends AbstractIntegrationTest {

    private static final String MURAL = "/aluno/comunidade/mural";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private UUID alunoB;
    private JsonNode loginA;
    private JsonNode loginB;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia");
        alunoB = api.criarAluno(admin, "Beto Fictício");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
    }

    // ---- ajudantes ----

    private Map<String, Object> corpo(String tipo, String texto, String video, List<String> fotos) {
        Map<String, Object> c = new LinkedHashMap<>();
        if (tipo != null) {
            c.put("tipo", tipo);
        }
        c.put("texto", texto);
        if (video != null) {
            c.put("videoUrl", video);
        }
        if (fotos != null) {
            c.put("fotoIds", fotos);
        }
        return c;
    }

    private JsonNode alunoPosta(JsonNode login, String tipo, String texto) throws Exception {
        return api.post(MURAL, login, corpo(tipo, texto, null, null), 200);
    }

    private JsonNode equipePosta(String tipo, String texto, String video) throws Exception {
        return api.post("/comunidade/mural", admin, corpo(tipo, texto, video, null), 200);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private UUID usuarioDoAluno(UUID aluno) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, aluno);
    }

    private UUID consultoria() {
        return jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, alunoA);
    }

    private String campoDoErro(JsonNode erro) {
        return erro.get("fieldErrors").get(0).get("field").asString();
    }

    private List<String> ids(JsonNode pagina) {
        List<String> r = new ArrayList<>();
        pagina.get("content").forEach(p -> r.add(p.get("id").asString()));
        return r;
    }

    private void nasceuHaAnos(UUID aluno, int anos, int diasAMais) {
        jdbc.update("update aluno set data_nascimento = ? where id = ?",
                LocalDate.now(Fuso.BRASILIA).minusYears(anos).plusDays(diasAMais), aluno);
    }

    private MvcResult enviarFoto(JsonNode login, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart(MURAL + "/fotos").file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", bytes))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andExpect(status().is(esperado)).andReturn();
    }

    private String fotoPendente(JsonNode login) throws Exception {
        return api.ler(enviarFoto(login, FotosDeTeste.jpeg(Color.BLUE, 200, false), 200)).get("id").asString();
    }

    private byte[] baixar(String caminho, JsonNode login, int esperado) throws Exception {
        MvcResult r = mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
        if (esperado == 200) {
            assertThat(r.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        }
        return r.getResponse().getContentAsByteArray();
    }

    private static byte[] jpegPesado() throws Exception {
        BufferedImage imagem = new BufferedImage(800, 800, BufferedImage.TYPE_INT_RGB);
        Random sorteio = new Random(7);
        for (int y = 0; y < 800; y++) {
            for (int x = 0; x < 800; x++) {
                imagem.setRGB(x, y, sorteio.nextInt(0x1000000));
            }
        }
        ImageWriter escritor = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam parametros = escritor.getDefaultWriteParam();
        parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        parametros.setCompressionQuality(0.9f);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (MemoryCacheImageOutputStream fluxo = new MemoryCacheImageOutputStream(saida)) {
            escritor.setOutput(fluxo);
            escritor.write(null, new IIOImage(imagem, null, null), parametros);
        } finally {
            escritor.dispose();
        }
        return saida.toByteArray();
    }

    // ---- tipos por papel (C1, C2, C3, C4) ----

    @Test
    void alunoPublicaConversaDuvidaEResultadoESemTipoViraConversa() throws Exception {
        assertThat(alunoPosta(loginA, null, "Sem assunto").get("tipo").asString()).isEqualTo("CONVERSA");
        for (String tipo : List.of("CONVERSA", "DUVIDA", "RESULTADO")) {
            assertThat(alunoPosta(loginA, tipo, "Post " + tipo).get("tipo").asString()).isEqualTo(tipo);
        }
    }

    @Test
    void alunoNaoPublicaAvisoNemVideoNemTipoDesconhecidoEQuemTemLinkSoOVideo() throws Exception {
        for (String tipo : List.of("AVISO", "VIDEO", "INVENTADO")) {
            JsonNode erro = api.post(MURAL, loginA, corpo(tipo, "Oi", null, null), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("POST_INVALIDO");
            assertThat(campoDoErro(erro)).isEqualTo("tipo");
            if (tipo.equals("INVENTADO")) {
                assertThat(erro.toString()).doesNotContain(tipo);
            }
        }
        JsonNode link = api.post(MURAL, loginA, corpo("DUVIDA", "Oi", "https://exemplo.test/v", null), 422);
        assertThat(campoDoErro(link)).isEqualTo("videoUrl");
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", usuarioDoAluno(alunoA))).isZero();
    }

    @Test
    void equipePublicaTodosOsTiposAvisoNasceFixadoEVideoPedeHttps() throws Exception {
        JsonNode aviso = equipePosta("AVISO", "Academia fecha na sexta", null);
        assertThat(aviso.get("fixado").asBoolean()).isTrue();
        assertThat(equipePosta("DUVIDA", "Pergunta da equipe", null).get("fixado").asBoolean()).isFalse();
        assertThat(equipePosta("CONVERSA", "Bom dia", null).get("tipo").asString()).isEqualTo("CONVERSA");

        JsonNode video = equipePosta("VIDEO", "Aula nova", "https://exemplo.test/aula");
        assertThat(video.get("videoUrl").asString()).isEqualTo("https://exemplo.test/aula");

        JsonNode semLink = api.post("/comunidade/mural", admin, corpo("VIDEO", "Sem link", null, null), 422);
        assertThat(campoDoErro(semLink)).isEqualTo("videoUrl");
        for (String ruim : List.of("http://exemplo.test/v", "javascript:alert(1)", "https://u:s@exemplo.test/v")) {
            JsonNode erro = api.post("/comunidade/mural", admin, corpo("VIDEO", "Ruim", ruim, null), 422);
            assertThat(campoDoErro(erro)).isEqualTo("videoUrl");
            assertThat(erro.toString()).doesNotContain(ruim);
        }
        JsonNode avisoComLink = api.post("/comunidade/mural", admin, corpo("AVISO", "Aviso", "https://exemplo.test/v", null), 422);
        assertThat(campoDoErro(avisoComLink)).isEqualTo("videoUrl");
        // Equipe não anexa foto; aluno não usa a rota da equipe.
        JsonNode comFoto = api.post("/comunidade/mural", admin, corpo("CONVERSA", "Foto", null, List.of(UUID.randomUUID().toString())), 422);
        assertThat(campoDoErro(comFoto)).isEqualTo("fotoIds");
        api.post("/comunidade/mural", loginA, corpo("CONVERSA", "Oi", null, null), 403);
    }

    @Test
    void avisoFicaNoTopoEDepoisOsMaisNovosEFiltroPorTipo() throws Exception {
        String velho = alunoPosta(loginA, "CONVERSA", "Mais velho").get("id").asString();
        String duvida = alunoPosta(loginB, "DUVIDA", "Uma dúvida").get("id").asString();
        String aviso = equipePosta("AVISO", "Aviso fixado", null).get("id").asString();
        String novo = alunoPosta(loginA, "RESULTADO", "Mais novo").get("id").asString();

        for (JsonNode quem : List.of(loginA, admin)) {
            String rota = quem.equals(admin) ? "/comunidade/mural" : MURAL;
            assertThat(ids(api.get(rota, quem, 200))).containsExactly(aviso, novo, duvida, velho);
            assertThat(ids(api.get(rota + "?tipo=DUVIDA", quem, 200))).containsExactly(duvida);
            assertThat(ids(api.get(rota + "?tipo=AVISO", quem, 200))).containsExactly(aviso);
            JsonNode erro = api.get(rota + "?tipo=INVENTADO", quem, 400);
            assertThat(erro.get("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
            assertThat(erro.toString()).doesNotContain("INVENTADO");
        }
        // A equipe desafixa pela rota que já existia e o aviso desce na ordem.
        api.post("/comunidade/mural/" + aviso + "/fixar", admin, null, 204);
        assertThat(ids(api.get(MURAL, loginA, 200))).containsExactly(novo, aviso, duvida, velho);
    }

    // ---- busca (C5) ----

    @Test
    void buscaIgnoraAcentoECaixaNoMuralENasAulas() throws Exception {
        String perna = alunoPosta(loginA, "CONVERSA", "Treino de Glúteos e PERNAS").get("id").asString();
        alunoPosta(loginB, "CONVERSA", "Corrida leve");
        // O _ é literal, não curinga: só o post com sublinhado casa.
        String sublinhado = alunoPosta(loginB, "CONVERSA", "Meta_final").get("id").asString();

        for (JsonNode quem : List.of(loginA, admin)) {
            String rota = quem.equals(admin) ? "/comunidade/mural" : MURAL;
            assertThat(ids(api.get(rota + "?busca=gluteos", quem, 200))).containsExactly(perna);
            assertThat(ids(api.get(rota + "?busca=PERNAS e", quem, 200)).size()).isZero();
            assertThat(api.get(rota + "?busca=nada disso", quem, 200).get("content")).isEmpty();
            assertThat(ids(api.get(rota + "?busca=_", quem, 200))).containsExactly(sublinhado);
        }

        api.post("/comunidade/aulas", admin, Map.of("titulo", "Aulão de Periodização", "descricao", "Cargas e séries", "videoUrl", "https://exemplo.test/a"), 200);
        api.post("/comunidade/aulas", admin, Map.of("titulo", "Mobilidade", "descricao", "Quadril e ombros", "videoUrl", "https://exemplo.test/b"), 200);
        for (String rota : List.of("/aluno/comunidade/aulas?busca=periodizacao", "/aluno/comunidade/aulas?busca=SERIES")) {
            JsonNode lista = api.get(rota, loginA, 200);
            assertThat(lista).hasSize(1);
            assertThat(lista.get(0).get("titulo").asString()).isEqualTo("Aulão de Periodização");
        }
        assertThat(api.get("/comunidade/aulas?busca=quadril", admin, 200)).hasSize(1);
        assertThat(api.get("/comunidade/aulas?busca=", admin, 200)).hasSize(2);
    }

    // ---- dúvida (C6) ----

    @Test
    void duvidaRespondidaPelaEquipeTemRespostaNoTopoEAprovaORespondida() throws Exception {
        String duvida = alunoPosta(loginA, "DUVIDA", "Como faço agachamento?").get("id").asString();
        String conversa = alunoPosta(loginA, "CONVERSA", "Bom dia").get("id").asString();
        api.post(MURAL + "/" + duvida + "/comentarios", loginB, Map.of("texto", "Eu também queria saber"), 200);
        assertThat(respondida(duvida)).isFalse();

        JsonNode resposta = api.post("/comunidade/mural/" + duvida + "/comentarios", admin, Map.of("texto", "Desça até 90 graus"), 200);
        assertThat(resposta.get("daEquipe").asBoolean()).isTrue();
        api.post(MURAL + "/" + duvida + "/comentarios", loginA, Map.of("texto", "Obrigada"), 200);

        for (JsonNode quem : List.of(loginA, admin)) {
            String rota = quem.equals(admin) ? "/comunidade/mural/" : MURAL + "/";
            JsonNode itens = api.get(rota + duvida + "/comentarios", quem, 200).get("itens");
            assertThat(itens).hasSize(3);
            assertThat(itens.get(0).get("texto").asString()).isEqualTo("Desça até 90 graus");
            assertThat(itens.get(0).get("daEquipe").asBoolean()).isTrue();
            assertThat(itens.get(1).get("daEquipe").asBoolean()).isFalse();
            assertThat(itens.get(1).get("texto").asString()).isEqualTo("Eu também queria saber");
        }
        assertThat(respondida(duvida)).isTrue();
        // Só a dúvida tem "respondida"; comentário da equipe em outro tipo não a muda.
        api.post("/comunidade/mural/" + conversa + "/comentarios", admin, Map.of("texto", "Bom dia!"), 200);
        assertThat(respondida(conversa)).isFalse();
        // Comentário de aluno nunca é da equipe, e a equipe só comenta com a permissão de moderar.
        api.post("/comunidade/mural/" + duvida + "/comentarios", loginA, Map.of("texto", "Oi"), 403);
        // Moderar o comentário da equipe tira a marca de respondida.
        jdbc.update("update comunidade_mural_comentario set oculto = true where post_id = ?::uuid and da_equipe", duvida);
        assertThat(respondida(duvida)).isFalse();
    }

    private boolean respondida(String postId) throws Exception {
        for (JsonNode p : api.get(MURAL + "?tamanho=50", loginB, 200).get("content")) {
            if (p.get("id").asString().equals(postId)) {
                return p.get("respondida").asBoolean();
            }
        }
        throw new AssertionError("Post fora da lista");
    }

    // ---- fotos (C7, C8, C9) ----

    @Test
    void semDataDeNascimentoOuMenorDe18NaoAnexaEMaiorAnexa() throws Exception {
        JsonNode semData = api.ler(enviarFoto(loginA, FotosDeTeste.jpeg(Color.RED), 403));
        assertThat(semData.get("codigo").asString()).isEqualTo("FOTO_NAO_PERMITIDA");
        assertThat(api.get("/aluno/comunidade/configuracao", loginA, 200).get("podeAnexarFoto").asBoolean()).isFalse();

        // 17 anos e 364 dias: amanhã faz 18.
        nasceuHaAnos(alunoA, 18, 1);
        JsonNode menor = api.ler(enviarFoto(loginA, FotosDeTeste.jpeg(Color.RED), 403));
        assertThat(menor.toString()).doesNotContain("nascimento");
        // Fez 18 hoje.
        nasceuHaAnos(alunoA, 18, 0);
        assertThat(api.get("/aluno/comunidade/configuracao", loginA, 200).get("podeAnexarFoto").asBoolean()).isTrue();
        enviarFoto(loginA, FotosDeTeste.jpeg(Color.RED), 200);
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioDoAluno(alunoA))).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioDoAluno(alunoB))).isZero();
    }

    @Test
    void chaveDeFotosDesligadaBarraOUploadMasNaoOTexto() throws Exception {
        nasceuHaAnos(alunoA, 30, 0);
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true, "alunosAnexamFotos", false), 200);
        assertThat(api.ler(enviarFoto(loginA, FotosDeTeste.jpeg(Color.RED), 403)).get("codigo").asString()).isEqualTo("FOTO_NAO_PERMITIDA");
        JsonNode config = api.get("/aluno/comunidade/configuracao", loginA, 200);
        assertThat(config.get("alunosPublicam").asBoolean()).isTrue();
        assertThat(config.get("podeAnexarFoto").asBoolean()).isFalse();
        assertThat(config.toString()).doesNotContain("nascimento");
        alunoPosta(loginA, "CONVERSA", "Só texto");
        // Foto pendente de antes da chave também não entra no post com a chave desligada.
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true, "alunosAnexamFotos", true), 200);
        String id = fotoPendente(loginA);
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true, "alunosAnexamFotos", false), 200);
        api.post(MURAL, loginA, corpo("RESULTADO", "Com foto", null, List.of(id)), 403);
    }

    @Test
    void fotoVaiAoPostELeEntregaSemMetadadosComNoStoreParaColegaEEquipe() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.BLUE, 300, false));
        assertThat(FotosDeTeste.contem(suja, FotosDeTeste.MARCA_EXIF)).isTrue();
        String f1 = api.ler(enviarFoto(loginA, suja, 200)).get("id").asString();
        String f2 = fotoPendente(loginA);

        // Pendente: só o dono lê; colega e equipe, 404.
        assertThat(FotosDeTeste.contem(baixar(MURAL + "/fotos/" + f1, loginA, 200), FotosDeTeste.MARCA_EXIF)).isFalse();
        baixar(MURAL + "/fotos/" + f1, loginB, 404);
        baixar("/comunidade/mural/fotos/" + f1, admin, 404);

        JsonNode post = api.post(MURAL, loginA, corpo("RESULTADO", "Meu resultado", null, List.of(f2, f1)), 200);
        assertThat(post.get("fotos")).hasSize(2);
        // Ordem do envio (f1 foi enviada primeiro), a mesma na resposta e na lista.
        assertThat(post.get("fotos").get(0).asString()).isEqualTo(f1);
        assertThat(post.get("fotos").get(1).asString()).isEqualTo(f2);
        JsonNode daLista = api.get(MURAL, loginB, 200).get("content").get(0);
        assertThat(daLista.get("fotos")).isEqualTo(post.get("fotos"));
        for (String id : List.of(f1, f2)) {
            byte[] bytes = baixar(MURAL + "/fotos/" + id, loginB, 200);
            assertThat(bytes.length).isGreaterThan(100);
            baixar("/comunidade/mural/fotos/" + id, admin, 200);
        }
        // Já ligada: apagar como pendente dá 404 e o post segue com as fotos.
        api.delete(MURAL + "/fotos/" + f1, loginA, 404);
        assertThat(contar("select count(*) from comunidade_mural_foto where post_id = ?::uuid", post.get("id").asString())).isEqualTo(2);
        // Aluno não usa a rota de bytes da equipe.
        baixar("/comunidade/mural/fotos/" + f1, loginB, 403);
    }

    @Test
    void ligarFotoAlheiaInexistenteOuJaLigadaDa422NoCampoENadaFicaPublicado() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        nasceuHaAnos(alunoB, 25, 0);
        String minha = fotoPendente(loginA);
        String doColega = fotoPendente(loginB);
        UUID autor = usuarioDoAluno(alunoA);

        for (List<String> lista : List.of(List.of(doColega), List.of(minha, doColega), List.of(UUID.randomUUID().toString()),
                List.of(minha, minha))) {
            JsonNode erro = api.post(MURAL, loginA, corpo("CONVERSA", "Não sai", null, lista), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("POST_INVALIDO");
            assertThat(campoDoErro(erro)).isEqualTo("fotoIds");
        }
        // Atômico: a minha continua pendente e não há post.
        assertThat(contar("select count(*) from comunidade_mural_foto where id = ?::uuid and post_id is null", minha)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_foto where id = ?::uuid and post_id is null", doColega)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", autor)).isZero();

        api.post(MURAL, loginA, corpo("CONVERSA", "Sai", null, List.of(minha)), 200);
        // Já ligada: não liga de novo.
        assertThat(campoDoErro(api.post(MURAL, loginA, corpo("CONVERSA", "De novo", null, List.of(minha)), 422))).isEqualTo("fotoIds");
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", autor)).isEqualTo(1);

        // De 0 a 4 fotos.
        List<String> cinco = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            cinco.add(UUID.randomUUID().toString());
        }
        assertThat(campoDoErro(api.post(MURAL, loginA, corpo("CONVERSA", "Cinco", null, cinco), 422))).isEqualTo("fotoIds");
    }

    @Test
    void arquivoInvalidoGrandeDemaisETetoDe20PorDia() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        assertThat(api.ler(enviarFoto(loginA, "isto não é jpeg".getBytes(java.nio.charset.StandardCharsets.UTF_8), 422)).get("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        assertThat(api.ler(enviarFoto(loginA, new byte[0], 422)).get("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        assertThat(api.ler(enviarFoto(loginA, jpegPesado(), 422)).get("codigo").asString()).isEqualTo("FOTO_GRANDE_DEMAIS");
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioDoAluno(alunoA))).isZero();

        // Os envios recusados acima não gastam cota; apagar a pendente também não devolve (decisão C7): 20 enviadas e apagadas, a 21ª recusa.
        UUID autor = usuarioDoAluno(alunoA);
        for (int i = 0; i < 20; i++) {
            api.delete(MURAL + "/fotos/" + fotoPendente(loginA), loginA, 204);
        }
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", autor)).isZero();
        assertThat(api.ler(enviarFoto(loginA, FotosDeTeste.jpeg(Color.RED), 422)).get("codigo").asString()).isEqualTo("FOTOS_LIMITE_DIARIO");
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", autor)).isZero();
        // Outro aluno tem o próprio teto.
        nasceuHaAnos(alunoB, 25, 0);
        enviarFoto(loginB, FotosDeTeste.jpeg(Color.RED), 200);
    }

    @Test
    void textoComSilabasCoreanasPublicaMesmoComAFormaDecompostaMaiorQueAColuna() throws Exception {
        // Cada sílaba vira 3 letras na forma decomposta (6000 no total, a coluna do texto de busca é de 2000).
        String post = alunoPosta(loginA, "CONVERSA", "한".repeat(2000)).get("id").asString();
        assertThat(contar("select length(texto_busca) from comunidade_mural_post where id = ?::uuid", post)).isEqualTo(2000);
    }

    @Test
    void pendenteComMaisDe24HSaiNoProximoEnvioEApagarPendenteVale() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        UUID autor = usuarioDoAluno(alunoA);
        jdbc.update("insert into comunidade_mural_foto (consultoria_id, post_id, autor_id, bytes, tamanho, criado_em) "
                + "values (?, null, ?, ?, 3, now() - interval '25 hours')", consultoria(), autor, new byte[] {1, 2, 3});
        String nova = fotoPendente(loginA);
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", autor)).isEqualTo(1);

        api.delete(MURAL + "/fotos/" + nova, loginB, 404);
        api.delete(MURAL + "/fotos/" + nova, loginA, 204);
        api.delete(MURAL + "/fotos/" + nova, loginA, 404);
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", autor)).isZero();
    }

    @Test
    void moderarOPostApagaAsFotosDele() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        String foto = fotoPendente(loginA);
        String post = api.post(MURAL, loginA, corpo("RESULTADO", "Com foto", null, List.of(foto)), 200).get("id").asString();
        api.delete("/comunidade/mural/" + post, admin, 204);
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioDoAluno(alunoA))).isZero();
        baixar(MURAL + "/fotos/" + foto, loginB, 404);
    }

    @Test
    void outraConsultoriaNaoLeNemApagaNemDenunciaNemComentaFoto() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        String foto = fotoPendente(loginA);
        String post = api.post(MURAL, loginA, corpo("RESULTADO", "Com foto", null, List.of(foto)), 200).get("id").asString();
        JsonNode outroTreinador = api.novoTreinador();
        JsonNode outroAluno = api.convidarEEntrar(outroTreinador, api.criarAluno(outroTreinador, "Aluno de fora"));

        baixar(MURAL + "/fotos/" + foto, outroAluno, 404);
        baixar("/comunidade/mural/fotos/" + foto, outroTreinador, 404);
        api.delete(MURAL + "/fotos/" + foto, outroAluno, 404);
        api.post(MURAL + "/" + post + "/denuncias", outroAluno, Map.of("motivo", "SPAM"), 404);
        api.post("/comunidade/mural/" + post + "/denuncias/dispensar", outroTreinador, null, 404);
        api.post("/comunidade/mural/" + post + "/comentarios", outroTreinador, Map.of("texto", "Oi"), 404);
        assertThat(contar("select count(*) from comunidade_mural_foto where id = ?::uuid", foto)).isEqualTo(1);
        assertThat(api.get("/comunidade/mural", outroTreinador, 200).get("content")).isEmpty();
    }

    // ---- denúncia (C10) ----

    @Test
    void denunciaEIdempotenteNaoVaiNoProprioPostEMotivoVemDaLista() throws Exception {
        String post = alunoPosta(loginA, "CONVERSA", "Post polêmico").get("id").asString();
        String rota = MURAL + "/" + post + "/denuncias";

        api.post(rota, loginB, Map.of("motivo", "SPAM"), 204);
        api.post(rota, loginB, Map.of("motivo", "OFENSIVO"), 204);
        assertThat(contar("select count(*) from comunidade_mural_denuncia where post_id = ?::uuid", post)).isEqualTo(1);

        assertThat(campoDoErro(api.post(rota, loginB, Map.of("motivo", "QUALQUER"), 422))).isEqualTo("motivo");
        api.post(rota, loginB, Map.of("motivo", " "), 400);
        JsonNode propria = api.post(rota, loginA, Map.of("motivo", "SPAM"), 422);
        assertThat(propria.get("codigo").asString()).isEqualTo("DENUNCIA_INVALIDA");
        api.post(MURAL + "/" + UUID.randomUUID() + "/denuncias", loginB, Map.of("motivo", "SPAM"), 404);
        assertThat(contar("select count(*) from comunidade_mural_denuncia where post_id = ?::uuid", post)).isEqualTo(1);
    }

    @Test
    void equipeVeAContagemFiltraOsDenunciadosEDispensaEAlunoNuncaVeNada() throws Exception {
        String limpo = alunoPosta(loginA, "CONVERSA", "Post tranquilo").get("id").asString();
        String sujo = alunoPosta(loginA, "CONVERSA", "Post denunciado").get("id").asString();
        api.post(MURAL + "/" + sujo + "/denuncias", loginB, Map.of("motivo", "IMPROPRIO"), 204);
        jdbc.update("insert into comunidade_mural_denuncia (consultoria_id, post_id, usuario_id, motivo) values (?, ?::uuid, ?, 'SPAM')",
                consultoria(), sujo, usuarioDoAluno(alunoA));

        JsonNode daEquipe = api.get("/comunidade/mural", admin, 200);
        for (JsonNode p : daEquipe.get("content")) {
            long esperado = p.get("id").asString().equals(sujo) ? 2 : 0;
            assertThat(p.get("denuncias").asLong()).isEqualTo(esperado);
        }
        assertThat(ids(api.get("/comunidade/mural?denunciados=true", admin, 200))).containsExactly(sujo);
        // Para o aluno não existe contagem nem filtro (o parâmetro é ignorado).
        JsonNode doAluno = api.get(MURAL + "?denunciados=true", loginB, 200);
        assertThat(doAluno.get("content")).hasSize(2);
        for (JsonNode p : doAluno.get("content")) {
            assertThat(p.path("denuncias").isNull() || p.path("denuncias").isMissingNode()).isTrue();
        }
        assertThat(doAluno.toString()).doesNotContain("IMPROPRIO");

        api.post("/comunidade/mural/" + sujo + "/denuncias/dispensar", loginB, null, 403);
        api.post("/comunidade/mural/" + sujo + "/denuncias/dispensar", admin, null, 204);
        api.post("/comunidade/mural/" + sujo + "/denuncias/dispensar", admin, null, 204);
        assertThat(contar("select count(*) from comunidade_mural_denuncia where post_id = ?::uuid", sujo)).isZero();
        assertThat(api.get("/comunidade/mural?denunciados=true", admin, 200).get("content")).isEmpty();
        // Auditoria só quando havia o que dispensar, com resumo fixo.
        assertThat(contar("select count(*) from auditoria where consultoria_id = ? and acao = 'COMUNIDADE_DENUNCIAS_DISPENSADAS'",
                consultoria())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'COMUNIDADE_DENUNCIAS_DISPENSADAS'",
                String.class, consultoria())).doesNotContain("SPAM").doesNotContain("IMPROPRIO").doesNotContain(sujo).doesNotContain(limpo);
    }

    // ---- chaves do treinador (C9) ----

    @Test
    void configuracaoComecaLigadaAuditaSoNaMudancaEDesligarPublicarBarraSoOAlunoQuePublica() throws Exception {
        JsonNode padrao = api.get("/comunidade/configuracao", admin, 200);
        assertThat(padrao.get("alunosPublicam").asBoolean()).isTrue();
        assertThat(padrao.get("alunosAnexamFotos").asBoolean()).isTrue();
        UUID c = consultoria();
        String auditoria = "select count(*) from auditoria where consultoria_id = ? and acao = 'COMUNIDADE_CONFIGURACAO_ALTERADA'";

        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true, "alunosAnexamFotos", true), 200);
        assertThat(contar(auditoria, c)).isZero();

        JsonNode nova = api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", false, "alunosAnexamFotos", true), 200);
        assertThat(nova.get("alunosPublicam").asBoolean()).isFalse();
        assertThat(contar(auditoria, c)).isEqualTo(1);
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", false, "alunosAnexamFotos", true), 200);
        assertThat(contar(auditoria, c)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'COMUNIDADE_CONFIGURACAO_ALTERADA'",
                String.class, c)).doesNotContain("false").doesNotContain("true");

        String post = equipePosta("CONVERSA", "Post da equipe", null).get("id").asString();
        JsonNode erro = api.post(MURAL, loginA, corpo("CONVERSA", "Não pode", null, null), 403);
        assertThat(erro.get("codigo").asString()).isEqualTo("PUBLICACAO_DESLIGADA");
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", usuarioDoAluno(alunoA))).isZero();
        // Comentar e reagir continuam; a equipe também segue publicando; o aluno enxerga a chave.
        api.post(MURAL + "/" + post + "/comentarios", loginA, Map.of("texto", "Oi"), 200);
        api.post(MURAL + "/" + post + "/reacoes", loginA, Map.of("emoji", "🔥"), 204);
        equipePosta("AVISO", "Aviso", null);
        assertThat(api.get("/aluno/comunidade/configuracao", loginA, 200).get("alunosPublicam").asBoolean()).isFalse();

        // Corpo incompleto, aluno e anônimo.
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", true), 400);
        api.put("/comunidade/configuracao", loginA, Map.of("alunosPublicam", true, "alunosAnexamFotos", true), 403);
        api.get("/comunidade/configuracao", loginA, 403);
        api.get("/comunidade/configuracao", null, 401);
        api.get("/aluno/comunidade/configuracao", admin, 403);
    }

    @Test
    void configuracaoDeOutraConsultoriaNaoMudaAMinha() throws Exception {
        JsonNode outro = api.novoTreinador();
        api.put("/comunidade/configuracao", outro, Map.of("alunosPublicam", false, "alunosAnexamFotos", false), 200);
        JsonNode minha = api.get("/comunidade/configuracao", admin, 200);
        assertThat(minha.get("alunosPublicam").asBoolean()).isTrue();
        assertThat(minha.get("alunosAnexamFotos").asBoolean()).isTrue();
    }

    // ---- exportação e anonimização (LGPD) ----

    private String montarConteudoDaAna() throws Exception {
        nasceuHaAnos(alunoA, 25, 0);
        String foto = fotoPendente(loginA);
        String postA = api.post(MURAL, loginA, corpo("RESULTADO", "Resultado da Ana", null, List.of(foto)), 200).get("id").asString();
        String postB = alunoPosta(loginB, "DUVIDA", "Dúvida do Beto").get("id").asString();
        api.post(MURAL + "/" + postB + "/denuncias", loginA, Map.of("motivo", "OUTRO"), 204);
        api.post(MURAL + "/" + postA + "/denuncias", loginB, Map.of("motivo", "SPAM"), 204);
        return foto;
    }

    @Test
    void exportacaoLevaTipoFotoSoComoMetadadoEAsDenunciasQueAAnaFez() throws Exception {
        String foto = montarConteudoDaAna();

        JsonNode comunidade = api.get("/alunos/" + alunoA + "/exportacao", admin, 200).get("comunidade");

        JsonNode post = comunidade.get("posts").get(0);
        assertThat(post.get("tipo").asString()).isEqualTo("RESULTADO");
        assertThat(post.has("videoUrl")).isTrue();
        assertThat(comunidade.get("fotos")).hasSize(1);
        JsonNode f = comunidade.get("fotos").get(0);
        assertThat(f.get("id").asString()).isEqualTo(foto);
        assertThat(f.get("tamanho").asInt()).isPositive();
        assertThat(f.has("bytes")).isFalse();
        assertThat(f.has("criadoEm")).isTrue();
        // Só as denúncias que ela fez (a do Beto contra o post dela não é dela); sem o post de quem foi denunciado além do id.
        assertThat(comunidade.get("denuncias")).hasSize(1);
        assertThat(comunidade.get("denuncias").get(0).get("motivo").asString()).isEqualTo("OUTRO");
        assertThat(comunidade.get("denuncias").toString()).doesNotContain("SPAM");
        assertThat(comunidade.toString()).doesNotContain("Dúvida do Beto");
    }

    @Test
    void excluirAContaApagaFotosEDenunciasDelaEOTextoDoPost() throws Exception {
        montarConteudoDaAna();
        UUID usuarioA = usuarioDoAluno(alunoA);
        UUID usuarioB = usuarioDoAluno(alunoB);

        api.post("/aluno/conta/excluir", loginA, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioA)).isZero();
        assertThat(contar("select count(*) from comunidade_mural_denuncia where usuario_id = ?", usuarioA)).isZero();
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ? and texto = '' and oculto and video_url is null"
                + " and texto_busca = ''", usuarioA)).isEqualTo(1);
        // O que é do Beto fica.
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ? and not oculto", usuarioB)).isEqualTo(1);
    }

    @Test
    void anonimizarPeloTreinadorTambemApagaFotosEDenuncias() throws Exception {
        montarConteudoDaAna();
        UUID usuarioA = usuarioDoAluno(alunoA);
        api.patch("/alunos/" + alunoA + "/situacao", admin, Map.of("ativo", false), 200);

        api.post("/alunos/" + alunoA + "/anonimizar", admin, Map.of("nomeConfirmado", "Ana Fictícia"), 200);

        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioA)).isZero();
        assertThat(contar("select count(*) from comunidade_mural_denuncia where usuario_id = ?", usuarioA)).isZero();
    }
}
