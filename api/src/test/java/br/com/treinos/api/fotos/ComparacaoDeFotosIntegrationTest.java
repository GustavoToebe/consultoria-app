package br.com.treinos.api.fotos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
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
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Comparação de fotos: linha do tempo, autorização e JPEG no servidor. Só quadrados coloridos. */
@AutoConfigureMockMvc
class ComparacaoDeFotosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

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
        banco.update("update anamnese set enviada_em = now() - interval '10 days' where id = ?::uuid", anamnese.id());

        UUID azul = subir(FotosDeTeste.jpeg(Color.BLUE));
        UUID verde = subir(FotosDeTeste.jpeg(Color.GREEN));
        UUID extra = subir(FotosDeTeste.jpeg(Color.YELLOW));
        UUID pendente = subir(FotosDeTeste.jpeg(Color.MAGENTA));
        JsonNode enviada = enviar(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6,
                "fotos", List.of(azul.toString(), verde.toString(), extra.toString())), 200);
        banco.update("update atualizacao_foto set removida_em = now() where id = ?::uuid", extra);

        JsonNode linha = api.get("/alunos/" + aluno + "/fotos", treinador, 200);
        assertThat(linha).hasSize(3);
        assertThat(linha.get(0).path("origem").asString()).isEqualTo("ANAMNESE");
        assertThat(linha.get(0).path("fotoId").asString()).isEqualTo(fotoAnamnese);
        assertThat(linha.get(0).path("posicao").asString()).isEqualTo("Fotos fictícias");
        assertThat(linha.get(0).path("pesoKg").isNull()).isTrue();
        assertThat(linha.get(1).path("origem").asString()).isEqualTo("ATUALIZACAO");
        assertThat(linha.get(1).path("origemId").asString()).isEqualTo(enviada.path("id").asString());
        assertThat(linha.get(1).path("posicao").asString()).isEqualTo("Fotos em jejum");
        assertThat(linha.get(1).path("ordem").asInt()).isZero();
        assertThat(linha.get(1).path("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(linha.get(2).path("ordem").asInt()).isEqualTo(1);
        assertThat(linha.valueStream().map(n -> n.path("fotoId").asString())).doesNotContain(pendente.toString(), extra.toString());

        JsonNode doAluno = api.get("/aluno/fotos/linha-do-tempo", loginAluno, 200);
        assertThat(doAluno).hasSize(3);
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
        assertThat(jpeg.getResponse().getHeader("Content-Disposition")).contains("comparacao.jpg");
        byte[] bytes = jpeg.getResponse().getContentAsByteArray();
        assertThat(JpegSemMetadados.temMetadados(bytes)).isFalse();
        BufferedImage imagem = ImageIO.read(new ByteArrayInputStream(bytes));
        assertThat(imagem.getWidth()).isEqualTo(1080);
        assertThat(imagem.getHeight()).isGreaterThan(400);

        enviarLogo();
        MvcResult comLogo = comparar(List.of(azul, verde), true, 200);
        BufferedImage marcada = ImageIO.read(new ByteArrayInputStream(comLogo.getResponse().getContentAsByteArray()));
        var layout = LayoutDaComparacao.montar(2, true, 20, 20);
        int px = marcada.getRGB(layout.logo().x() + layout.logo().largura() / 2, layout.logo().y() + layout.logo().altura() / 2);
        assertThat((px >> 16) & 0xFF).isGreaterThan(150);
        assertThat(px & 0xFF).isLessThan(80);
        assertThat(contagem("COMPARACAO_DE_FOTOS_GERADA")).isEqualTo(2);
        assertThat(banco.queryForObject(
                "select count(*) from auditoria where acao = 'COMPARACAO_DE_FOTOS_GERADA' and entidade_id = ?::uuid and resumo = ?",
                Integer.class, aluno, ComparacaoDeFotosService.RESUMO_GERADA)).isEqualTo(2);
        comparar(List.of(azul, pendente), false, 404);
        comparar(List.of(azul), false, 400);
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

    private int contagem(String acao) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class, acao, aluno);
    }

    private MvcResult comparar(List<UUID> ids, boolean comLogo, int esperado) throws Exception {
        return mvc.perform(post("/alunos/" + aluno + "/fotos/comparacao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("fotoIds", ids, "comLogo", comLogo)))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andExpect(status().is(esperado)).andReturn();
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

    private record AnamneseEnviada(String id, String foto) {
    }

    private AnamneseEnviada anamneseComFoto() throws Exception {
        JsonNode q = api.post("/questionarios", treinador, Map.of("nome", "Com fotos", "origem", "VAZIO", "finalidade", "ANAMNESE"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Com fotos");
        corpo.put("conteudo", Map.of("instrucoes", List.of(), "secoes", List.of(Map.of("uid", "s1", "titulo", "A",
                "perguntas", List.of(Map.of("id", "fotos", "tipo", "FOTOS", "rotulo", "Fotos fictícias", "obrigatoria", true))))));
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
        api.post("/aluno/anamnese/" + a.path("id").asString() + "/enviar", loginAluno,
                Map.of("questionarioVersaoId", a.path("questionarioVersaoId").asString(), "respostas", Map.of("fotos", List.of(foto))), 200);
        return new AnamneseEnviada(a.path("id").asString(), foto);
    }
}
