package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.fotos.FotosDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
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
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Foto de perfil trocada e apagada pela equipe ({@code ALUNO_ALTERAR}); a de corpo não muda. Só dados fictícios. */
@AutoConfigureMockMvc
class FotoPerfilPelaEquipeIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Aluna Fictícia Equipe";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, NOME);
    }

    private MvcResult enviar(JsonNode login, UUID alunoId, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, "/alunos/" + alunoId + "/foto-perfil")
                        .file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", bytes))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private void apagar(JsonNode login, UUID alunoId, int esperado) throws Exception {
        mvc.perform(delete("/alunos/" + alunoId + "/foto-perfil").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado));
    }

    private byte[] baixar(JsonNode login, UUID alunoId, int esperado) throws Exception {
        return mvc.perform(get("/alunos/" + alunoId + "/foto-perfil").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn().getResponse().getContentAsByteArray();
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private int fotos() {
        return jdbc.queryForObject("select count(*) from aluno_foto_perfil where aluno_id = ?", Integer.class, aluno);
    }

    private int auditorias(String acao) {
        return jdbc.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?", Integer.class, acao, aluno);
    }

    /** JPEG de ruído que, mesmo sem metadados, passa de 300 KB, mas cabe no limite do corpo. */
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

    @Test
    void equipeTrocaApagaEAuditaComResumoFixo() throws Exception {
        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.BLUE));
        assertThat(FotosDeTeste.contem(suja, FotosDeTeste.MARCA_EXIF)).isTrue();
        assertThat(api.ler(enviar(treinador, aluno, suja, 200)).path("atualizadaEm").asString()).isNotBlank();
        assertThat(FotosDeTeste.contem(baixar(treinador, aluno, 200), FotosDeTeste.MARCA_EXIF)).isFalse();
        assertThat(auditorias("ALUNO_FOTO_PERFIL_ALTERADA_PELA_EQUIPE")).isEqualTo(1);

        // Trocar de novo substitui (uma foto por aluno).
        enviar(treinador, aluno, FotosDeTeste.jpeg(Color.GREEN), 200);
        assertThat(fotos()).isEqualTo(1);
        assertThat(auditorias("ALUNO_FOTO_PERFIL_ALTERADA_PELA_EQUIPE")).isEqualTo(2);

        String resumo = jdbc.queryForObject(
                "select resumo from auditoria where acao = 'ALUNO_FOTO_PERFIL_ALTERADA_PELA_EQUIPE' and entidade_id = ? limit 1",
                String.class, aluno);
        assertThat(resumo).isEqualTo("Trocou a foto de perfil do aluno.").doesNotContain(NOME);

        apagar(treinador, aluno, 204);
        assertThat(fotos()).isZero();
        baixar(treinador, aluno, 404);
        assertThat(auditorias("ALUNO_FOTO_PERFIL_REMOVIDA_PELA_EQUIPE")).isEqualTo(1);

        // Sem foto, apagar é idempotente e não audita de novo.
        apagar(treinador, aluno, 204);
        assertThat(auditorias("ALUNO_FOTO_PERFIL_REMOVIDA_PELA_EQUIPE")).isEqualTo(1);
    }

    @Test
    void alunoVeAFotoTrocadaPelaEquipe() throws Exception {
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        enviar(treinador, aluno, FotosDeTeste.jpeg(Color.ORANGE), 200);
        mvc.perform(get("/aluno/foto-perfil").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isOk());
        apagar(treinador, aluno, 204);
        mvc.perform(get("/aluno/foto-perfil").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isNotFound());
        // O aluno não usa a rota da equipe.
        enviar(loginAluno, aluno, FotosDeTeste.jpeg(Color.RED), 403);
        apagar(loginAluno, aluno, 403);
    }

    @Test
    void semAlunoAlterarDa403MasAEquipeComSoAlunoLerContinuaLendo() throws Exception {
        enviar(treinador, aluno, FotosDeTeste.jpeg(Color.BLUE), 200);
        JsonNode leitor = membro(Set.of("ALUNO_LER"));
        enviar(leitor, aluno, FotosDeTeste.jpeg(Color.RED), 403);
        apagar(leitor, aluno, 403);
        assertThat(baixar(leitor, aluno, 200)).isNotEmpty();
        assertThat(fotos()).isEqualTo(1);
        assertThat(auditorias("ALUNO_FOTO_PERFIL_REMOVIDA_PELA_EQUIPE")).isZero();
    }

    @Test
    void outraConsultoriaDa404() throws Exception {
        enviar(treinador, aluno, FotosDeTeste.jpeg(Color.BLUE), 200);
        JsonNode outro = api.novoTreinador();
        enviar(outro, aluno, FotosDeTeste.jpeg(Color.RED), 404);
        apagar(outro, aluno, 404);
        assertThat(fotos()).isEqualTo(1);
    }

    @Test
    void anonimizadoDa409NaTrocaEForaDaFaixaOuFormatoDa422() throws Exception {
        MvcResult texto = enviar(treinador, aluno, "não é imagem".getBytes(StandardCharsets.UTF_8), 422);
        assertThat(api.ler(texto).path("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        enviar(treinador, aluno, FotosDeTeste.jpeg(Color.RED, 1100, false), 422);
        assertThat(fotos()).isZero();

        MvcResult pesada = enviar(treinador, aluno, jpegPesado(), 422);
        assertThat(api.ler(pesada).path("codigo").asString()).isEqualTo("FOTO_GRANDE_DEMAIS");

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", NOME), 200);
        MvcResult anonimizado = enviar(treinador, aluno, FotosDeTeste.jpeg(Color.RED), 409);
        assertThat(api.ler(anonimizado).path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(fotos()).isZero();
    }

    @Test
    void apagarDeAlunoAnonimizadoDa204SemAuditoriaNova() throws Exception {
        enviar(treinador, aluno, FotosDeTeste.jpeg(Color.BLUE), 200);
        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", NOME), 200);
        // A anonimização já apagou a foto; apagar de novo é idempotente e não audita.
        assertThat(fotos()).isZero();
        apagar(treinador, aluno, 204);
        assertThat(fotos()).isZero();
        assertThat(auditorias("ALUNO_FOTO_PERFIL_REMOVIDA_PELA_EQUIPE")).isZero();
    }
}
