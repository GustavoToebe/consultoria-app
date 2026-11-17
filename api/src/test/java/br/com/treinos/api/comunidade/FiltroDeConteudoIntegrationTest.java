package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Filtro de conteúdo (plano filtro-de-conteudo-comunidade): post e comentário de aluno com termo da lista dão 422 no campo
 * {@code texto}, sem gravar e sem repetir o texto; a equipe não é filtrada. Só dados fictícios.
 */
@AutoConfigureMockMvc
class FiltroDeConteudoIntegrationTest extends AbstractIntegrationTest {

    private static final String MURAL = "/aluno/comunidade/mural";
    /** Termo da lista, escrito de um jeito que o corpo da resposta nunca deve devolver. */
    private static final String RUIM = "Que BUCETA enorme";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private JsonNode loginA;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia");
        loginA = api.convidarEEntrar(admin, alunoA);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private UUID usuarioDoAluno() {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, alunoA);
    }

    private String aula() throws Exception {
        return api.post("/comunidade/aulas", admin,
                Map.of("titulo", "Aulão", "videoUrl", "https://exemplo.test/aula", "publicada", true), 200).get("id").asString();
    }

    private void conferirRecusa(JsonNode erro, String codigo) {
        assertThat(erro.get("codigo").asString()).isEqualTo(codigo);
        assertThat(erro.get("fieldErrors")).hasSize(1);
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("texto");
        assertThat(erro.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Sua publicação tem uma palavra não permitida.");
        assertThat(erro.toString().toLowerCase(java.util.Locale.ROOT)).doesNotContain("buceta").doesNotContain("enorme");
    }

    @Test
    void postDeAlunoComTermoDa422NoCampoTextoENadaFicaGravado() throws Exception {
        for (String tipo : List.of("CONVERSA", "DUVIDA", "RESULTADO")) {
            conferirRecusa(api.post(MURAL, loginA, Map.of("tipo", tipo, "texto", RUIM), 422), "POST_INVALIDO");
        }
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", usuarioDoAluno())).isZero();
        // Anatomia e treino passam.
        api.post(MURAL, loginA, Map.of("texto", "Treino de peito, coxa e glúteo. Bunda firme!"), 200);
        assertThat(contar("select count(*) from comunidade_mural_post where autor_id = ?", usuarioDoAluno())).isEqualTo(1);
    }

    @Test
    void comentarioDeAlunoNoMuralEnoAulaoComTermoDa422ENadaFicaGravado() throws Exception {
        String post = api.post("/comunidade/mural", admin, Map.of("texto", "Bom dia"), 200).get("id").asString();
        String aula = aula();

        conferirRecusa(api.post(MURAL + "/" + post + "/comentarios", loginA, Map.of("texto", RUIM), 422), "COMUNIDADE_INVALIDA");
        conferirRecusa(api.post("/aluno/comunidade/aulas/" + aula + "/comentarios", loginA, Map.of("texto", "pornô!"), 422),
                "COMUNIDADE_INVALIDA");
        assertThat(contar("select count(*) from comunidade_mural_comentario where autor_id = ?", usuarioDoAluno())).isZero();
        assertThat(contar("select count(*) from comunidade_aula_comentario where autor_id = ?", usuarioDoAluno())).isZero();

        api.post(MURAL + "/" + post + "/comentarios", loginA, Map.of("texto", "Georgia é linda"), 200);
        api.post("/aluno/comunidade/aulas/" + aula + "/comentarios", loginA, Map.of("texto", "Ótimo aulão de peito"), 200);
    }

    @Test
    void equipeNaoEFiltrada() throws Exception {
        String post = api.post("/comunidade/mural", admin, Map.of("texto", RUIM), 200).get("id").asString();
        api.post("/comunidade/mural/" + post + "/comentarios", admin, Map.of("texto", RUIM), 200);
        api.post("/comunidade/aulas/" + aula() + "/comentarios", admin, Map.of("texto", RUIM), 200);
    }

    @Test
    void postInexistenteComTermoContinuaDando404() throws Exception {
        api.post(MURAL + "/" + UUID.randomUUID() + "/comentarios", loginA, Map.of("texto", RUIM), 404);
    }
}
