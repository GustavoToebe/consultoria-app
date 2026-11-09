package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comunidade (V065/V068): isolamento por consultoria (404, nunca 204 mudo), links só https (422), ranking que mostra só a
 * posição do próprio aluno, exportação e anonimização do que o aluno escreveu. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ComunidadeIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME_DO_COLEGA = "Colega Sentinela Fictícia";
    private static final String TEXTO_A = "Texto fictício do post da Ana";
    private static final String COMENTARIO_A = "Comentário fictício da Ana";

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
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    /** Dois alunos da mesma consultoria: A (Ana) e B (o colega com nome sentinela). */
    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia");
        alunoB = api.criarAluno(admin, NOME_DO_COLEGA);
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
    }

    private Map<String, Object> aula(String video, String miniatura, boolean publicada) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("titulo", "Aulão fictício");
        corpo.put("videoUrl", video);
        corpo.put("miniaturaUrl", miniatura);
        corpo.put("publicada", publicada);
        return corpo;
    }

    private String criarAula(JsonNode treinador, boolean publicada) throws Exception {
        return api.post("/comunidade/aulas", treinador, aula("https://youtube.com/watch?v=abc", null, publicada), 200)
                .get("id").asString();
    }

    private String criarPost(JsonNode aluno, String texto) throws Exception {
        return api.post("/aluno/comunidade/mural", aluno, Map.of("texto", texto), 200).get("id").asString();
    }

    private UUID usuarioDoAluno(UUID alunoId) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, alunoId);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    /** Outra consultoria com aula, post e um comentário em cada. */
    private record Outra(JsonNode treinador, String aula, String post, String comentarioDeAula, String comentarioDeMural) {}

    private Outra outraConsultoria() throws Exception {
        JsonNode treinador = api.novoTreinador();
        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno de outra consultoria"));
        String aula = criarAula(treinador, true);
        String post = criarPost(aluno, "Post fictício de outra consultoria");
        String comentarioDeAula = api.post("/aluno/comunidade/aulas/" + aula + "/comentarios", aluno,
                Map.of("texto", "Dúvida fictícia"), 200).get("id").asString();
        String comentarioDeMural = api.post("/aluno/comunidade/mural/" + post + "/comentarios", aluno,
                Map.of("texto", "Comentário fictício"), 200).get("id").asString();
        return new Outra(treinador, aula, post, comentarioDeAula, comentarioDeMural);
    }

    // ---- isolamento (B1) ----

    @Test
    void alunoNaoEnxergaNemGravaEmRecursoDeOutraConsultoria() throws Exception {
        Outra o = outraConsultoria();

        api.get("/aluno/comunidade/aulas/" + o.aula + "/comentarios", loginA, 404);
        api.post("/aluno/comunidade/aulas/" + o.aula + "/comentarios", loginA, Map.of("texto", "Oi"), 404);
        api.get("/aluno/comunidade/mural/" + o.post + "/comentarios", loginA, 404);
        api.post("/aluno/comunidade/mural/" + o.post + "/comentarios", loginA, Map.of("texto", "Oi"), 404);
        api.post("/aluno/comunidade/mural/" + o.post + "/reacoes", loginA, Map.of("emoji", "🔥"), 404);

        assertThat(contar("select count(*) from comunidade_aula_comentario where aula_id = ?::uuid", o.aula)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_comentario where post_id = ?::uuid", o.post)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_reacao where post_id = ?::uuid", o.post)).isZero();
    }

    @Test
    void equipeRecebe404EmVezDe204MudoEmRecursoDeOutraConsultoria() throws Exception {
        Outra o = outraConsultoria();

        api.put("/comunidade/aulas/" + o.aula, admin, aula("https://youtube.com/watch?v=x", null, true), 404);
        api.delete("/comunidade/aulas/" + o.aula, admin, 404);
        api.get("/comunidade/aulas/" + o.aula + "/comentarios", admin, 404);
        api.post("/comunidade/aulas/" + o.aula + "/comentarios", admin, Map.of("texto", "Oi"), 404);
        api.delete("/comunidade/aulas/comentarios/" + o.comentarioDeAula, admin, 404);
        api.delete("/comunidade/mural/" + o.post, admin, 404);
        api.post("/comunidade/mural/" + o.post + "/fixar", admin, null, 404);
        api.delete("/comunidade/mural/comentarios/" + o.comentarioDeMural, admin, 404);
        // Id que não existe em lugar nenhum: o mesmo 404.
        api.delete("/comunidade/mural/" + UUID.randomUUID(), admin, 404);

        // Nada da outra consultoria mudou.
        assertThat(contar("select count(*) from comunidade_aula where id = ?::uuid", o.aula)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and not oculto and not fixado", o.post))
                .isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_comentario where id = ?::uuid and not oculto", o.comentarioDeMural))
                .isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_aula_comentario where id = ?::uuid and not oculto", o.comentarioDeAula))
                .isEqualTo(1);
    }

    @Test
    void aulaNaoPublicadaEPostOcultoDao404ParaOAluno() throws Exception {
        String rascunho = criarAula(admin, false);
        List<String> idsVistosPeloAluno = new ArrayList<>();
        api.get("/aluno/comunidade/aulas", loginA, 200).forEach(a -> idsVistosPeloAluno.add(a.get("id").asString()));
        assertThat(idsVistosPeloAluno).doesNotContain(rascunho);
        api.get("/aluno/comunidade/aulas/" + rascunho + "/comentarios", loginA, 404);
        api.post("/aluno/comunidade/aulas/" + rascunho + "/comentarios", loginA, Map.of("texto", "Oi"), 404);
        // A equipe da mesma consultoria vê e responde.
        api.post("/comunidade/aulas/" + rascunho + "/comentarios", admin, Map.of("texto", "Resposta"), 200);

        String post = criarPost(loginB, "Post que será ocultado");
        api.delete("/comunidade/mural/" + post, admin, 204);
        api.get("/aluno/comunidade/mural/" + post + "/comentarios", loginA, 404);
        api.post("/aluno/comunidade/mural/" + post + "/reacoes", loginA, Map.of("emoji", "🔥"), 404);
    }

    @Test
    void alunoSemPermissaoDeEquipeNaoModera() throws Exception {
        String post = criarPost(loginA, TEXTO_A);
        api.delete("/comunidade/mural/" + post, loginA, 403);
        api.post("/comunidade/aulas", loginA, aula("https://youtube.com/watch?v=abc", null, true), 403);
        api.get("/aluno/comunidade/aulas", admin, 403);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and not oculto", post)).isEqualTo(1);
    }

    // ---- links (M5) ----

    @Test
    void linkForaDoHttpsDa422NoCampoSemRepetirOValor() throws Exception {
        for (String ruim : List.of("javascript:alert(1)", "http://exemplo.test/video", "https://u:s@exemplo.test/video")) {
            JsonNode erro = api.post("/comunidade/aulas", admin, aula(ruim, null, true), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("COMUNIDADE_INVALIDA");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("videoUrl");
            assertThat(erro.toString()).doesNotContain(ruim);
        }
        JsonNode miniatura = api.post("/comunidade/aulas", admin,
                aula("https://youtube.com/watch?v=abc", "http://exemplo.test/m.png", true), 422);
        assertThat(miniatura.get("fieldErrors").get(0).get("field").asString()).isEqualTo("miniaturaUrl");

        Map<String, Object> post = new LinkedHashMap<>();
        post.put("texto", "Oi");
        post.put("imagemUrl", "javascript:alert(1)");
        JsonNode imagem = api.post("/aluno/comunidade/mural", loginA, post, 422);
        assertThat(imagem.get("fieldErrors").get(0).get("field").asString()).isEqualTo("imagemUrl");
        assertThat(imagem.toString()).doesNotContain("javascript");

        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", usuarioDoAluno(alunoA))).isZero();
        post.put("imagemUrl", "https://exemplo.test/foto.png");
        assertThat(api.post("/aluno/comunidade/mural", loginA, post, 200).get("imagemUrl").asString())
                .isEqualTo("https://exemplo.test/foto.png");
    }

    @Test
    void linkAntigoForaDaRegraNaoSaiNaLeitura() throws Exception {
        String aula = criarAula(admin, true);
        jdbc.update("update comunidade_aula set video_url = 'http://exemplo.test/antigo', miniatura_url = 'javascript:x' where id = ?::uuid",
                aula);
        for (JsonNode a : api.get("/aluno/comunidade/aulas", loginA, 200)) {
            if (a.get("id").asString().equals(aula)) {
                assertThat(a.get("videoUrl").isNull()).isTrue();
                assertThat(a.get("miniaturaUrl").isNull()).isTrue();
                return;
            }
        }
        throw new AssertionError("A aula publicada deveria estar na lista do aluno.");
    }

    // ---- ranking (A4) ----

    @Test
    void rankingMostraSoAPosicaoDoProprioAluno() throws Exception {
        var treinoB = ApiDeTeste.treino();
        api.publicarTreino(admin, alunoB, treinoB.conteudo());
        String versaoB = api.get("/aluno/painel", loginB, 200).get("treino").get("versaoId").asString();
        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", UUID.randomUUID().toString());
        sessao.put("planoVersaoId", versaoB);
        sessao.put("sessaoUid", treinoB.sessaoUid().toString());
        sessao.put("data", hoje.toString());
        sessao.put("concluida", true);
        sessao.put("resultado", "COMPLETA");
        sessao.put("duracaoSegundos", 3000);
        sessao.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/sessoes-concluidas", loginB, Map.of("registros", List.of(sessao)), 200);

        JsonNode daAna = api.get("/aluno/comunidade/ranking", loginA, 200);
        List<String> campos = new ArrayList<>();
        daAna.propertyNames().forEach(campos::add);
        assertThat(campos).containsExactlyInAnyOrder("posicao", "treinosConcluidos", "pontuacao", "participantes");
        assertThat(daAna.get("posicao").asInt()).isEqualTo(2);
        assertThat(daAna.get("treinosConcluidos").asInt()).isZero();
        assertThat(daAna.get("participantes").asInt()).isEqualTo(2);
        assertThat(daAna.toString()).doesNotContain(NOME_DO_COLEGA).doesNotContain(alunoB.toString())
                .doesNotContain(usuarioDoAluno(alunoB).toString());

        JsonNode doColega = api.get("/aluno/comunidade/ranking", loginB, 200);
        assertThat(doColega.get("posicao").asInt()).isEqualTo(1);
        assertThat(doColega.get("treinosConcluidos").asInt()).isEqualTo(1);
        assertThat(doColega.get("pontuacao").asInt()).isEqualTo(10);
    }

    @Test
    void rankingDeForcaSaiu() throws Exception {
        assertThat(api.get("/aluno/comunidade/ranking", loginA, 200).has("forca")).isFalse();
    }

    // ---- exportação e anonimização (M6) ----

    /** A posta, comenta (aula e mural) e reage ao post do colega; o colega também posta e reage ao dela. */
    private String escreverNaComunidade() throws Exception {
        String aula = criarAula(admin, true);
        String postA = criarPost(loginA, TEXTO_A);
        api.post("/aluno/comunidade/aulas/" + aula + "/comentarios", loginA, Map.of("texto", COMENTARIO_A), 200);
        api.post("/aluno/comunidade/mural/" + postA + "/comentarios", loginA, Map.of("texto", COMENTARIO_A), 200);
        String postB = criarPost(loginB, "Texto fictício do colega");
        api.post("/aluno/comunidade/mural/" + postB + "/reacoes", loginA, Map.of("emoji", "🔥"), 204);
        api.post("/aluno/comunidade/mural/" + postA + "/reacoes", loginB, Map.of("emoji", "💪"), 204);
        return postA;
    }

    @Test
    void exportacaoTrazOQueOAlunoEscreveuNaComunidade() throws Exception {
        escreverNaComunidade();

        JsonNode comunidade = api.get("/alunos/" + alunoA + "/exportacao", admin, 200).get("comunidade");

        assertThat(comunidade.get("posts")).hasSize(1);
        assertThat(comunidade.get("posts").get(0).get("texto").asString()).isEqualTo(TEXTO_A);
        assertThat(comunidade.get("comentariosDeAulas")).hasSize(1);
        assertThat(comunidade.get("comentariosDoMural")).hasSize(1);
        assertThat(comunidade.get("reacoes")).hasSize(1);
        assertThat(comunidade.get("reacoes").get(0).get("emoji").asString()).isEqualTo("🔥");
        assertThat(comunidade.get("truncado").asBoolean()).isFalse();
        // Nada do colega (a reação dele ao post da Ana não é da Ana).
        assertThat(comunidade.toString()).doesNotContain("colega").doesNotContain("💪");
    }

    @Test
    void anonimizarPeloProprioAlunoApagaOTextoEAsReacoesESoDele() throws Exception {
        String postA = escreverNaComunidade();
        UUID usuarioA = usuarioDoAluno(alunoA);
        UUID usuarioB = usuarioDoAluno(alunoB);

        api.post("/aluno/conta/excluir", loginA, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        for (String tabela : List.of("comunidade_mural_post", "comunidade_mural_comentario", "comunidade_aula_comentario")) {
            assertThat(contar("select count(*) from " + tabela + " where autor_id = ? and autor_nome = 'Aluno anonimizado'"
                    + " and texto = '' and oculto and autor_foto_url is null", usuarioA)).as(tabela).isEqualTo(1);
            assertThat(contar("select count(*) from " + tabela + " where autor_id = ? and (texto <> '' or autor_nome <> 'Aluno anonimizado')",
                    usuarioA)).as(tabela).isZero();
        }
        assertThat(contar("select count(*) from comunidade_mural_reacao where usuario_id = ?", usuarioA)).isZero();

        // O colega e o que ele fez ficam: post com texto, e a reação dele ao post da Ana.
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ? and texto <> '' and not oculto", usuarioB))
                .isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_reacao where usuario_id = ? and post_id = ?::uuid", usuarioB, postA))
                .isEqualTo(1);
        // O post anonimizado some do mural dos outros (oculto).
        for (JsonNode p : api.get("/aluno/comunidade/mural", loginB, 200).get("content")) {
            assertThat(p.get("texto").asString()).isNotEmpty();
        }
    }

    @Test
    void anonimizarPeloTreinadorFazOMesmo() throws Exception {
        escreverNaComunidade();
        UUID usuarioA = usuarioDoAluno(alunoA);
        api.patch("/alunos/" + alunoA + "/situacao", admin, Map.of("ativo", false), 200);

        api.post("/alunos/" + alunoA + "/anonimizar", admin, Map.of("nomeConfirmado", "Ana Fictícia"), 200);

        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ? and texto = '' and oculto"
                + " and autor_nome = 'Aluno anonimizado'", usuarioA)).isEqualTo(1);
        assertThat(contar("select count(*) from comunidade_mural_reacao where usuario_id = ?", usuarioA)).isZero();
        // O banco é compartilhado entre os testes: só o post do colega deste teste.
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?"
                + " and texto = 'Texto fictício do colega' and not oculto", usuarioDoAluno(alunoB))).isEqualTo(1);
    }

    // ---- limite de escritas (B5) ----

    @Test
    void escritasDoAlunoTemLimiteDeCentoEVinteNaHora() throws Exception {
        String post = criarPost(loginA, TEXTO_A);
        // A criação do post já gastou uma; mais 119 passam e a seguinte leva 429.
        for (int i = 0; i < 119; i++) {
            api.post("/aluno/comunidade/mural/" + post + "/reacoes", loginA, Map.of("emoji", "🔥"), 204);
        }
        api.post("/aluno/comunidade/mural/" + post + "/reacoes", loginA, Map.of("emoji", "🔥"), 429);
        api.post("/aluno/comunidade/mural", loginA, Map.of("texto", "Outro"), 429);
        // Outro aluno tem o próprio balde; leitura não conta.
        api.post("/aluno/comunidade/mural/" + post + "/reacoes", loginB, Map.of("emoji", "👏"), 204);
        api.get("/aluno/comunidade/mural", loginA, 200);
    }
}
