package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.fotos.FotosDeTeste;
import br.com.treinos.api.fotos.FotosManutencao;
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

import java.awt.Color;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * C36: a equipe (COMUNIDADE_MODERAR) anexa de 0 a 4 fotos no post do mural, com as regras da foto do aluno (JPEG regravado,
 * 1600 px, 300 KB, teto diário, limpeza das pendentes). Cada teste cria a própria consultoria; só dados fictícios.
 */
@AutoConfigureMockMvc
class FotosDoMuralDaEquipeIntegrationTest extends AbstractIntegrationTest {

    private static final String EQUIPE = "/comunidade/mural";
    private static final String ALUNO = "/aluno/comunidade/mural";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private FotosManutencao manutencao;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private JsonNode loginA;
    private UUID usuarioDaEquipe;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia");
        loginA = api.convidarEEntrar(admin, alunoA);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, alunoA);
        usuarioDaEquipe = jdbc.queryForObject("select id from usuario where consultoria_id = ? and papel = 'TREINADOR'",
                UUID.class, consultoria);
        jdbc.update("update aluno set data_nascimento = ? where id = ?", LocalDate.now(Fuso.BRASILIA).minusYears(25), alunoA);
    }

    // ---- ajudantes ----

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private MvcResult enviar(String rota, JsonNode login, byte[] bytes, int esperado) throws Exception {
        return mvc.perform(multipart(rota + "/fotos").file(new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", bytes))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andExpect(status().is(esperado)).andReturn();
    }

    private String fotoDaEquipe(JsonNode login) throws Exception {
        return api.ler(enviar(EQUIPE, login, FotosDeTeste.jpeg(Color.BLUE, 200, false), 200)).get("id").asString();
    }

    private String fotoDoAluno() throws Exception {
        return api.ler(enviar(ALUNO, loginA, FotosDeTeste.jpeg(Color.RED, 200, false), 200)).get("id").asString();
    }

    private Map<String, Object> corpo(String texto, List<String> fotos) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("texto", texto);
        c.put("fotoIds", fotos);
        return c;
    }

    private byte[] baixar(String caminho, JsonNode login, int esperado) throws Exception {
        MvcResult r = mvc.perform(get(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().is(esperado)).andReturn();
        if (esperado == 200) {
            assertThat(r.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).contains("no-store");
        }
        return r.getResponse().getContentAsByteArray();
    }

    private void apagar(String caminho, JsonNode login, int esperado) throws Exception {
        mvc.perform(delete(caminho).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))).andExpect(status().is(esperado));
    }

    private String campoDoErro(JsonNode erro) {
        return erro.get("fieldErrors").get(0).get("field").asString();
    }

    private boolean existe(String fotoId) {
        return contar("select count(*) from comunidade_mural_foto where id = ?::uuid", fotoId) == 1;
    }

    // ---- publicar com fotos ----

    @Test
    void equipeAnexaUmaEQuatroFotosEOAlunoLeSemMetadadosComNoStore() throws Exception {
        byte[] suja = FotosDeTeste.comMetadados(FotosDeTeste.jpeg(Color.BLUE, 300, false));
        assertThat(FotosDeTeste.contem(suja, FotosDeTeste.MARCA_EXIF)).isTrue();
        String primeira = api.ler(enviar(EQUIPE, admin, suja, 200)).get("id").asString();

        // Pendente: a própria pessoa lê (prévia); o aluno, não.
        assertThat(FotosDeTeste.contem(baixar(EQUIPE + "/fotos/" + primeira, admin, 200), FotosDeTeste.MARCA_EXIF)).isFalse();
        baixar(ALUNO + "/fotos/" + primeira, loginA, 404);

        JsonNode um = api.post(EQUIPE, admin, corpo("Com uma foto", List.of(primeira)), 200);
        assertThat(um.get("fotos")).hasSize(1);
        assertThat(um.get("fotos").get(0).asString()).isEqualTo(primeira);
        assertThat(baixar(ALUNO + "/fotos/" + primeira, loginA, 200).length).isGreaterThan(100);

        List<String> quatro = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            quatro.add(fotoDaEquipe(admin));
        }
        JsonNode post = api.post(EQUIPE, admin, corpo("Com quatro fotos", quatro), 200);
        assertThat(post.get("fotos")).hasSize(4);
        JsonNode daLista = api.get(ALUNO, loginA, 200).get("content").get(0);
        assertThat(daLista.get("fotos")).isEqualTo(post.get("fotos"));
        // Sem fotos continua valendo (0 a 4).
        assertThat(api.post(EQUIPE, admin, corpo("Sem fotos", List.of()), 200).get("fotos")).isEmpty();
    }

    @Test
    void cincoFotosRepetidaAlheiaJaLigadaOuEnqueteDa422NoCampoENadaFicaPublicado() throws Exception {
        List<String> cinco = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            cinco.add(fotoDaEquipe(admin));
        }
        JsonNode erro = api.post(EQUIPE, admin, corpo("Cinco fotos", cinco), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("POST_INVALIDO");
        assertThat(campoDoErro(erro)).isEqualTo("fotoIds");

        String minha = fotoDaEquipe(admin);
        String doAluno = fotoDoAluno();
        for (List<String> lista : List.of(List.of(minha, minha), List.of(doAluno), List.of(minha, doAluno),
                List.of(UUID.randomUUID().toString()))) {
            assertThat(campoDoErro(api.post(EQUIPE, admin, corpo("Não sai", lista), 422))).isEqualTo("fotoIds");
        }
        Map<String, Object> enquete = new LinkedHashMap<>(corpo("Enquete com foto", List.of(minha)));
        enquete.put("tipo", "ENQUETE");
        enquete.put("opcoes", List.of("Sim", "Não"));
        assertThat(campoDoErro(api.post(EQUIPE, admin, enquete, 422))).isEqualTo("fotoIds");
        // Atômico: nada publicado e as pendentes continuam pendentes (a do aluno também).
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", usuarioDaEquipe)).isZero();
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ? and post_id is null", usuarioDaEquipe)).isEqualTo(6);
        assertThat(existe(doAluno)).isTrue();

        api.post(EQUIPE, admin, corpo("Sai", List.of(minha)), 200);
        // Já ligada: não liga de novo.
        assertThat(campoDoErro(api.post(EQUIPE, admin, corpo("De novo", List.of(minha)), 422))).isEqualTo("fotoIds");
        // A pendente da equipe também não entra no post de aluno.
        String outra = fotoDaEquipe(admin);
        assertThat(campoDoErro(api.post(ALUNO, loginA, corpo("Roubada", List.of(outra)), 422))).isEqualTo("fotoIds");
    }

    // ---- rota da equipe ----

    @Test
    void alunoNaoUsaAsRotasDeFotoDaEquipe() throws Exception {
        enviar(EQUIPE, loginA, FotosDeTeste.jpeg(Color.RED), 403);
        String doAluno = fotoDoAluno();
        apagar(EQUIPE + "/fotos/" + doAluno, loginA, 403);
        assertThat(existe(doAluno)).isTrue();
        // E a equipe também não apaga a pendente do aluno.
        apagar(EQUIPE + "/fotos/" + doAluno, admin, 404);
        assertThat(existe(doAluno)).isTrue();
    }

    @Test
    void equipeApagaSoAPendenteDaPropriaPessoaEUmaVez() throws Exception {
        String nova = fotoDaEquipe(admin);
        apagar(EQUIPE + "/fotos/" + nova, admin, 204);
        apagar(EQUIPE + "/fotos/" + nova, admin, 404);
        assertThat(existe(nova)).isFalse();

        String ligada = fotoDaEquipe(admin);
        api.post(EQUIPE, admin, corpo("Com foto", List.of(ligada)), 200);
        apagar(EQUIPE + "/fotos/" + ligada, admin, 404);
        assertThat(existe(ligada)).isTrue();
    }

    @Test
    void arquivoInvalidoGrandeDemaisETetoDe20PorDiaComBaldeProprioPorUsuario() throws Exception {
        assertThat(api.ler(enviar(EQUIPE, admin, "isto não é jpeg".getBytes(java.nio.charset.StandardCharsets.UTF_8), 422))
                .get("codigo").asString()).isEqualTo("FOTO_INVALIDA");
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioDaEquipe)).isZero();

        // Apagar a pendente não devolve cota: 20 enviadas e apagadas, a 21ª recusa.
        for (int i = 0; i < 20; i++) {
            apagar(EQUIPE + "/fotos/" + fotoDaEquipe(admin), admin, 204);
        }
        assertThat(api.ler(enviar(EQUIPE, admin, FotosDeTeste.jpeg(Color.RED), 422)).get("codigo").asString())
                .isEqualTo("FOTOS_LIMITE_DIARIO");
        assertThat(contar("select count(*) from comunidade_mural_foto where autor_id = ?", usuarioDaEquipe)).isZero();
        // Outro usuário tem o próprio teto.
        fotoDoAluno();
    }

    @Test
    void equipeNaoDependeDasChavesDeFotosEPublicacaoDosAlunos() throws Exception {
        api.put("/comunidade/configuracao", admin, Map.of("alunosPublicam", false, "alunosAnexamFotos", false), 200);
        String foto = fotoDaEquipe(admin);
        assertThat(api.post(EQUIPE, admin, corpo("Equipe segue publicando", List.of(foto)), 200).get("fotos")).hasSize(1);
    }

    // ---- limpeza, moderação e anonimização ----

    @Test
    void manutencaoApagaAPendenteDaEquipeComMaisDe24HEPreservaARecenteALigadaEADeOutraConsultoria() throws Exception {
        JsonNode outroTreinador = api.novoTreinador();
        String antiga = fotoDaEquipe(admin);
        jdbc.update("update comunidade_mural_foto set criado_em = now() - interval '25 hours' where id = ?::uuid", antiga);
        String recente = fotoDaEquipe(admin);
        String ligada = fotoDaEquipe(admin);
        api.post(EQUIPE, admin, corpo("Com foto", List.of(ligada)), 200);
        jdbc.update("update comunidade_mural_foto set criado_em = now() - interval '72 hours' where id = ?::uuid", ligada);
        String deFora = fotoDaEquipe(outroTreinador);

        assertThat(manutencao.limparPendentesDoMural()).isGreaterThanOrEqualTo(1);

        assertThat(existe(antiga)).isFalse();
        assertThat(existe(recente)).isTrue();
        assertThat(existe(ligada)).isTrue();
        assertThat(existe(deFora)).isTrue();
    }

    @Test
    void moderarOPostApagaAsFotosDaEquipe() throws Exception {
        String foto = fotoDaEquipe(admin);
        String post = api.post(EQUIPE, admin, corpo("Com foto", List.of(foto)), 200).get("id").asString();
        api.delete(EQUIPE + "/" + post, admin, 204);
        assertThat(existe(foto)).isFalse();
        baixar(ALUNO + "/fotos/" + foto, loginA, 404);
    }

    @Test
    void anonimizarOAlunoNaoApagaAFotoDaEquipe() throws Exception {
        String doAluno = fotoDoAluno();
        api.post(ALUNO, loginA, corpo("Foto da Ana", List.of(doAluno)), 200);
        String daEquipe = fotoDaEquipe(admin);
        api.post(EQUIPE, admin, corpo("Foto da equipe", List.of(daEquipe)), 200);
        api.patch("/alunos/" + alunoA + "/situacao", admin, Map.of("ativo", false), 200);

        api.post("/alunos/" + alunoA + "/anonimizar", admin, Map.of("nomeConfirmado", "Ana Fictícia"), 200);

        assertThat(existe(doAluno)).isFalse();
        assertThat(existe(daEquipe)).isTrue();
    }

    @Test
    void outraConsultoriaNaoLeNemApagaNemLigaFotoDaEquipe() throws Exception {
        JsonNode outroTreinador = api.novoTreinador();
        JsonNode outroAluno = api.convidarEEntrar(outroTreinador, api.criarAluno(outroTreinador, "Aluno de fora"));
        String pendente = fotoDaEquipe(admin);
        String ligada = fotoDaEquipe(admin);
        api.post(EQUIPE, admin, corpo("Com foto", List.of(ligada)), 200);

        for (String id : List.of(pendente, ligada)) {
            baixar(EQUIPE + "/fotos/" + id, outroTreinador, 404);
            baixar(ALUNO + "/fotos/" + id, outroAluno, 404);
            apagar(EQUIPE + "/fotos/" + id, outroTreinador, 404);
        }
        assertThat(campoDoErro(api.post(EQUIPE, outroTreinador, corpo("Roubada", List.of(pendente)), 422))).isEqualTo("fotoIds");
        assertThat(existe(pendente)).isTrue();
        assertThat(contar("select count(*) from comunidade_mural_foto where id = ?::uuid and post_id is null", pendente)).isEqualTo(1);
        assertThat(api.get(EQUIPE, outroTreinador, 200).get("content")).isEmpty();
    }
}
