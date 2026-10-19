package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.fotos.FotosDeTeste;
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

import java.awt.Color;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Foto de perfil do aluno (opcional): o aluno troca e apaga a própria, a equipe vê, outra consultoria não. Só dados fictícios. */
@AutoConfigureMockMvc
class FotoPerfilIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Aluna Fictícia Perfil";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private JsonNode loginAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, NOME);
        loginAluno = api.convidarEEntrar(treinador, aluno);
    }

    private MvcResult enviar(JsonNode login, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart(HttpMethod.PUT, "/aluno/foto-perfil")
                        .file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", bytes))
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
    }

    private byte[] baixar(String caminho, JsonNode login, int esperado) throws Exception {
        return mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn().getResponse().getContentAsByteArray();
    }

    @Test
    void alunoTrocaVeERemoveEAEquipeVeSemMetadados() throws Exception {
        baixar("/aluno/foto-perfil", loginAluno, 404);
        baixar("/alunos/" + aluno + "/foto-perfil", treinador, 404);

        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.BLUE));
        assertThat(FotosDeTeste.contem(suja, FotosDeTeste.MARCA_EXIF)).isTrue();
        assertThat(api.ler(enviar(loginAluno, suja, 200)).path("atualizadaEm").asString()).isNotBlank();

        mvc.perform(get("/aluno/foto-perfil").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("no-store")));
        byte[] daEquipe = baixar("/alunos/" + aluno + "/foto-perfil", treinador, 200);
        assertThat(FotosDeTeste.contem(daEquipe, FotosDeTeste.MARCA_EXIF)).isFalse();
        assertThat(FotosDeTeste.contem(daEquipe, "Exif")).isFalse();

        // Trocar de novo substitui (uma foto por aluno).
        enviar(loginAluno, FotosDeTeste.jpeg(Color.GREEN), 200);
        assertThat(jdbc.queryForObject("select count(*) from aluno_foto_perfil where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);

        // Outra consultoria não vê nem descobre se existe.
        baixar("/alunos/" + aluno + "/foto-perfil", api.novoTreinador(), 404);

        mvc.perform(delete("/aluno/foto-perfil").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isNoContent());
        baixar("/aluno/foto-perfil", loginAluno, 404);
        baixar("/alunos/" + aluno + "/foto-perfil", treinador, 404);
    }

    @Test
    void soJpegPequenoESoODono() throws Exception {
        MvcResult texto = enviar(loginAluno, "não é imagem".getBytes(StandardCharsets.UTF_8), 422);
        assertThat(api.ler(texto).path("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        // Lado acima de 1024 px: recusa (o app manda 512).
        enviar(loginAluno, FotosDeTeste.jpeg(Color.RED, 1100, false), 422);
        // O treinador não tem foto de perfil de aluno para trocar; o aluno não lê a rota da equipe.
        enviar(treinador, FotosDeTeste.jpeg(Color.RED), 403);
        baixar("/alunos/" + aluno + "/foto-perfil", loginAluno, 403);
    }

    @Test
    void exportacaoLevaSoADataEAnonimizarApagaAFotoERecusaOutra() throws Exception {
        enviar(loginAluno, FotosDeTeste.jpeg(Color.ORANGE), 200);
        JsonNode exportado = api.get("/alunos/" + aluno + "/exportacao", treinador, 200);
        assertThat(exportado.path("fotoDePerfil").path("atualizadaEm").asString()).isNotBlank();
        assertThat(exportado.path("fotoDePerfil").has("jpeg")).isFalse();

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", NOME), 200);
        assertThat(jdbc.queryForObject("select count(*) from aluno_foto_perfil where aluno_id = ?", Integer.class, aluno)).isZero();
        baixar("/alunos/" + aluno + "/foto-perfil", treinador, 404);
        JsonNode depois = api.get("/alunos/" + aluno + "/exportacao", treinador, 200).path("fotoDePerfil");
        assertThat(depois.isMissingNode() || depois.isNull()).isTrue(); // sem foto, o campo nem vem (NON_NULL)
    }
}
