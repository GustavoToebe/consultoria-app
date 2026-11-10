package br.com.treinos.api.comunidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V069: permissão {@code COMUNIDADE_MODERAR}, apelido do aluno, perfil do colega e moderação do apelido. Dois alunos da mesma
 * consultoria (A e B) e dados só fictícios; o banco é compartilhado, então cada consulta direta filtra pelos ids do teste.
 */
@AutoConfigureMockMvc
class ComunidadeApelidoIntegrationTest extends AbstractIntegrationTest {

    private static final String APELIDO = "Aninha_Fit.01";

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

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia Apelido");
        alunoB = api.criarAluno(admin, "Beto Fictício Apelido");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
    }

    private UUID usuarioDoAluno(UUID alunoId) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, alunoId);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private void definir(JsonNode login, String apelido, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("apelido", apelido);
        api.put("/aluno/comunidade/apelido", login, corpo, esperado);
    }

    private JsonNode meusDados(JsonNode login) throws Exception {
        return api.get("/aluno/meus-dados", login, 200);
    }

    private String criarPost(JsonNode aluno, String texto) throws Exception {
        return api.post("/aluno/comunidade/mural", aluno, Map.of("texto", texto), 200).get("id").asString();
    }

    private JsonNode postNoMural(JsonNode leitor, String id) throws Exception {
        for (JsonNode p : api.get("/aluno/comunidade/mural?tamanho=50", leitor, 200).get("content")) {
            if (p.get("id").asString().equals(id)) {
                return p;
            }
        }
        throw new AssertionError("O post deveria estar na primeira página do mural.");
    }

    /** Membro da equipe de A/B com um perfil só com estas permissões. */
    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private int auditorias(String acao, UUID alunoId) {
        return contar("select count(*) from auditoria where acao = ? and entidade_id = ?", acao, alunoId);
    }

    // ---- A) COMUNIDADE_MODERAR ----

    @Test
    void soComunidadeModerarModeraETreinoAlterarSozinhoNao() throws Exception {
        String post = criarPost(loginA, "Texto fictício para moderar");
        JsonNode soTreino = membro(Set.of("TREINO_LER", "TREINO_ALTERAR"));
        api.delete("/comunidade/mural/" + post, soTreino, 403);
        api.post("/comunidade/mural/" + post + "/fixar", soTreino, null, 403);
        api.post("/comunidade/mural", soTreino, Map.of("texto", "Oi"), 403);
        api.delete("/comunidade/perfis/" + usuarioDoAluno(alunoA) + "/apelido", soTreino, 403);
        // Ler continua com TREINO_LER.
        api.get("/comunidade/mural", soTreino, 200);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and not oculto", post)).isEqualTo(1);

        JsonNode moderador = membro(Set.of("TREINO_LER", "COMUNIDADE_MODERAR"));
        api.post("/comunidade/mural/" + post + "/fixar", moderador, null, 204);
        api.delete("/comunidade/mural/" + post, moderador, 204);
        assertThat(contar("select count(*) from comunidade_mural_post where id = ?::uuid and oculto", post)).isEqualTo(1);
        // O Administrador (acesso total) também modera.
        String outro = criarPost(loginB, "Outro texto fictício");
        api.delete("/comunidade/mural/" + outro, admin, 204);
    }

    @Test
    void permissaoExigeTreinoLerENaoEscapaDoTetoDeQuemAtribui() throws Exception {
        api.post("/perfis", admin, Map.of("nome", "Só moderar " + UUID.randomUUID(), "permissoes", Set.of("COMUNIDADE_MODERAR")), 400);
        // Quem gerencia perfis mas não tem a permissão não a atribui (teto de permissões da equipe).
        JsonNode gerente = membro(Set.of("EQUIPE_LER", "PERFIL_ALTERAR", "TREINO_LER"));
        api.post("/perfis", gerente, Map.of("nome", "Teto " + UUID.randomUUID(),
                "permissoes", Set.of("TREINO_LER", "COMUNIDADE_MODERAR")), 403);
        JsonNode gerenteModerador = membro(Set.of("EQUIPE_LER", "PERFIL_ALTERAR", "TREINO_LER", "COMUNIDADE_MODERAR"));
        api.post("/perfis", gerenteModerador, Map.of("nome", "Cabe " + UUID.randomUUID(),
                "permissoes", Set.of("TREINO_LER", "COMUNIDADE_MODERAR")), 200);
    }

    @Test
    void treinadorPadraoDeConsultoriaNovaTemAPermissaoENutricionistaNao() {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, alunoA);
        assertThat(contar("select count(*) from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome = 'Treinador' and pp.codigo = 'COMUNIDADE_MODERAR'", consultoria)).isEqualTo(1);
        assertThat(contar("select count(*) from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome in ('Nutricionista', 'Assistente') and pp.codigo = 'COMUNIDADE_MODERAR'",
                consultoria)).isZero();
    }

    // ---- B) apelido ----

    @Test
    void apelidoValidoGravaNormalizadoApareceEmMeusDadosEAuditaSoQuandoMuda() throws Exception {
        assertThat(meusDados(loginA).get("apelido").isNull()).isTrue();

        definir(loginA, "  " + APELIDO + "  ", 204);
        assertThat(meusDados(loginA).get("apelido").asString()).isEqualTo(APELIDO);
        assertThat(auditorias("ALUNO_APELIDO_ALTERADO", alunoA)).isEqualTo(1);

        // Igual: sem efeito e sem outra linha de auditoria.
        definir(loginA, APELIDO, 204);
        assertThat(auditorias("ALUNO_APELIDO_ALTERADO", alunoA)).isEqualTo(1);
        // Repetido pode (outro aluno, mesmo apelido).
        definir(loginB, APELIDO, 204);

        // Acento: a forma decomposta (a + til combinante) é gravada composta.
        definir(loginA, "João Ñandú", 204);
        assertThat(meusDados(loginA).get("apelido").asString()).isEqualTo("João Ñandú");

        // Vazio, em branco e ausente apagam.
        definir(loginA, "   ", 204);
        assertThat(meusDados(loginA).get("apelido").isNull()).isTrue();
        definir(loginA, APELIDO, 204);
        api.put("/aluno/comunidade/apelido", loginA, Map.of(), 204);
        assertThat(meusDados(loginA).get("apelido").isNull()).isTrue();

        // A auditoria nunca leva o apelido.
        assertThat(contar("select count(*) from auditoria where entidade_id = ? and acao = 'ALUNO_APELIDO_ALTERADO'"
                + " and (resumo like '%Aninha%' or resumo like '%Nandú%' or resumo like '%Ñandú%')", alunoA)).isZero();
    }

    @Test
    void apelidoInvalidoDa422NoCampoSemRepetirOValorEMantemOAtual() throws Exception {
        definir(loginA, APELIDO, 204);
        for (String ruim : List.of("a", "x".repeat(25), "x".repeat(500), "ana@email.com", "www.meusite.com",
                "meu site.com.br", "http-ana", "Ana!!", "<b>ana</b>", "ana/ana", "ana:ana", "emoji 🔥 ok", "tab\tana")) {
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("apelido", ruim);
            JsonNode erro = api.put("/aluno/comunidade/apelido", loginA, corpo, 422);
            assertThat(erro.get("codigo").asString()).as(ruim).isEqualTo("APELIDO_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("apelido");
            if (ruim.strip().length() >= 5) { // valor curto aparece em qualquer texto
                assertThat(erro.toString()).as(ruim).doesNotContain(ruim.strip());
            }
        }
        assertThat(meusDados(loginA).get("apelido").asString()).isEqualTo(APELIDO);
        assertThat(auditorias("ALUNO_APELIDO_ALTERADO", alunoA)).isEqualTo(1);
        // Só o aluno define: a equipe não tem esta rota.
        api.put("/aluno/comunidade/apelido", admin, Map.of("apelido", "Equipe"), 403);
    }

    @Test
    void bancoRecusaApelidoForaDoFormatoEAceitaOQueAApiAceita() {
        jdbc.update("update aluno set apelido = ? where id = ?", "João Ñandú-2.0_x", alunoA);
        for (String ruim : List.of("a", "ana@x", " ana", "ana ", "ana!")) {
            assertThatThrownBy(() -> jdbc.update("update aluno set apelido = ? where id = ?", ruim, alunoA))
                    .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ck_aluno_apelido");
        }
    }

    @Test
    void apelidoSaiNoMuralENosComentariosDeMuralEDeAulaEAtualizaOuSomeNaHora() throws Exception {
        String aula = api.post("/comunidade/aulas", admin, Map.of("titulo", "Aulão fictício", "videoUrl", "https://youtube.com/watch?v=abc"),
                200).get("id").asString();
        String postA = criarPost(loginA, "Post fictício da Ana");
        String postDaEquipe = api.post("/comunidade/mural", admin, Map.of("texto", "Aviso fictício da equipe"), 200).get("id").asString();
        String comentarioMural = api.post("/aluno/comunidade/mural/" + postA + "/comentarios", loginA, Map.of("texto", "Oi"), 200)
                .get("id").asString();
        api.post("/aluno/comunidade/aulas/" + aula + "/comentarios", loginA, Map.of("texto", "Dúvida"), 200);

        // Sem apelido: nulo (também na resposta de quem acabou de criar).
        assertThat(postNoMural(loginB, postA).get("autorApelido").isNull()).isTrue();

        definir(loginA, APELIDO, 204);
        JsonNode post = postNoMural(loginB, postA);
        assertThat(post.get("autorApelido").asString()).isEqualTo(APELIDO);
        assertThat(post.get("autorNome").asString()).isEqualTo("Ana Fictícia Apelido");
        assertThat(postNoMural(loginB, postDaEquipe).get("autorApelido").isNull()).isTrue();
        // O perfil só abre para aluno: o mural diz quem é (equipe = falso).
        assertThat(post.get("autorEhAluno").asBoolean()).isTrue();
        assertThat(postNoMural(loginB, postDaEquipe).get("autorEhAluno").asBoolean()).isFalse();
        for (JsonNode c : api.get("/aluno/comunidade/mural/" + postA + "/comentarios", loginB, 200).get("itens")) {
            assertThat(c.get("autorEhAluno").asBoolean()).isTrue();
            assertThat(c.get("autorApelido").asString()).isEqualTo(APELIDO);
        }
        for (JsonNode c : api.get("/aluno/comunidade/aulas/" + aula + "/comentarios", loginB, 200).get("itens")) {
            assertThat(c.get("autorApelido").asString()).isEqualTo(APELIDO);
        }
        // Quem escreve agora já recebe o próprio apelido; a equipe recebe nulo.
        assertThat(api.post("/aluno/comunidade/mural/" + postA + "/comentarios", loginA, Map.of("texto", "De novo"), 200)
                .get("autorApelido").asString()).isEqualTo(APELIDO);
        assertThat(api.post("/comunidade/aulas/" + aula + "/comentarios", admin, Map.of("texto", "Resposta"), 200)
                .get("autorApelido").isNull()).isTrue();
        // A equipe também vê o apelido no mural dela.
        for (JsonNode p : api.get("/comunidade/mural?tamanho=50", admin, 200).get("content")) {
            if (p.get("id").asString().equals(postA)) {
                assertThat(p.get("autorApelido").asString()).isEqualTo(APELIDO);
            }
        }

        // Não é cópia: trocar vale para o post antigo, apagar some.
        definir(loginA, "Nova.Ana", 204);
        assertThat(postNoMural(loginB, postA).get("autorApelido").asString()).isEqualTo("Nova.Ana");
        definir(loginA, "", 204);
        assertThat(postNoMural(loginB, postA).get("autorApelido").isNull()).isTrue();
        assertThat(comentarioMural).isNotBlank();
    }

    // ---- perfil do colega ----

    @Test
    void perfilDoColegaDaMesmaConsultoriaTrazSoOPublicoENuncaContatoOuFoto() throws Exception {
        definir(loginB, APELIDO, 204);
        var treino = ApiDeTeste.treino();
        api.publicarTreino(admin, alunoB, treino.conteudo());
        concluirTreino(loginB, treino);
        // As conquistas já desbloqueadas aparecem (a tela do próprio aluno é quem as avalia).
        assertThat(api.get("/aluno/comunidade/conquistas", loginB, 200)).isNotEmpty();

        UUID usuarioB = usuarioDoAluno(alunoB);
        // Aluno novo sem data de nascimento nasce reservado (V070); aqui B escolhe aparecer.
        jdbc.update("update aluno set perfil_reservado = false where id = ?", alunoB);
        JsonNode perfil = api.get("/aluno/comunidade/perfis/" + usuarioB, loginA, 200);
        List<String> campos = new ArrayList<>();
        perfil.propertyNames().forEach(campos::add);
        assertThat(campos).containsExactlyInAnyOrder("autorId", "nome", "apelido", "ehVoce", "reservado", "treinosConcluidos", "nivel",
                "conquistas", "destaques", "cor", "moldura", "temFoto", "atividade", "recordes");
        assertThat(perfil.get("autorId").asString()).isEqualTo(usuarioB.toString());
        assertThat(perfil.get("nome").asString()).isEqualTo("Beto Fictício Apelido");
        assertThat(perfil.get("apelido").asString()).isEqualTo(APELIDO);
        assertThat(perfil.get("treinosConcluidos").asInt()).isEqualTo(1);
        assertThat(perfil.get("conquistas").get(0).get("tipo").asString()).isEqualTo("PRIMEIRO_TREINO");
        assertThat(perfil.get("ehVoce").asBoolean()).isFalse();
        String email = jdbc.queryForObject("select email from usuario where id = ?", String.class, usuarioB);
        assertThat(perfil.get("temFoto").asBoolean()).isFalse();
        assertThat(perfil.toString()).doesNotContain(email).doesNotContain(alunoB.toString()).doesNotContain("\"foto").doesNotContain("telefone")
                .doesNotContain("email").doesNotContain("cpf");

        assertThat(api.get("/aluno/comunidade/perfis/" + usuarioB, loginB, 200).get("ehVoce").asBoolean()).isTrue();
        // A equipe não usa a rota do aluno.
        api.get("/aluno/comunidade/perfis/" + usuarioB, admin, 403);
    }

    @Test
    void perfilDeQualquerOutroCasoDaOMesmoE404() throws Exception {
        JsonNode outraEquipe = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outraEquipe, "Aluno de outra consultoria");
        api.convidarEEntrar(outraEquipe, alunoDeFora);
        UUID equipe = jdbc.queryForObject("select id from usuario where consultoria_id = (select consultoria_id from aluno where id = ?)"
                + " and papel = 'TREINADOR' limit 1", UUID.class, alunoA);
        UUID inativo = api.criarAluno(admin, "Aluno inativo fictício");
        JsonNode loginInativo = api.convidarEEntrar(admin, inativo);
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);
        UUID anonimizado = api.criarAluno(admin, "Aluno anonimizado fictício");
        JsonNode loginAnonimizado = api.convidarEEntrar(admin, anonimizado);
        api.post("/aluno/conta/excluir", loginAnonimizado, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        List<UUID> alvos = List.of(usuarioDoAluno(alunoDeFora), equipe, usuarioDoAluno(inativo), usuarioDoAluno(anonimizado),
                UUID.randomUUID());
        JsonNode primeiro = null;
        for (UUID alvo : alvos) {
            JsonNode erro = api.get("/aluno/comunidade/perfis/" + alvo, loginA, 404);
            if (primeiro == null) {
                primeiro = erro;
            }
            assertThat(erro.get("message").asString()).isNotBlank().isEqualTo(primeiro.get("message").asString());
            assertThat(erro.get("error").asString()).isEqualTo(primeiro.get("error").asString());
        }
        assertThat(loginInativo).isNotNull();
    }

    // ---- moderação do apelido ----

    @Test
    void moderacaoLimpaOApelidoAudita1VezEAlunoPodePorOutroDepois() throws Exception {
        definir(loginA, APELIDO, 204);
        UUID usuarioA = usuarioDoAluno(alunoA);
        String caminho = "/comunidade/perfis/" + usuarioA + "/apelido";

        api.delete(caminho, loginA, 403);
        JsonNode moderador = membro(Set.of("TREINO_LER", "COMUNIDADE_MODERAR"));
        api.delete(caminho, moderador, 204);
        assertThat(meusDados(loginA).get("apelido").isNull()).isTrue();
        // Idempotente: de novo é 204 e não audita outra vez.
        api.delete(caminho, moderador, 204);
        assertThat(auditorias("COMUNIDADE_APELIDO_REMOVIDO", alunoA)).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where entidade_id = ? and acao = 'COMUNIDADE_APELIDO_REMOVIDO'"
                + " and resumo like '%Aninha%'", alunoA)).isZero();

        definir(loginA, "Outro.Apelido", 204);
        assertThat(meusDados(loginA).get("apelido").asString()).isEqualTo("Outro.Apelido");

        // Outra consultoria, membro da equipe (não é aluno) e id inexistente: 404.
        JsonNode outraEquipe = api.novoTreinador();
        api.delete(caminho, outraEquipe, 404);
        UUID equipe = jdbc.queryForObject("select id from usuario where consultoria_id = (select consultoria_id from aluno where id = ?)"
                + " and papel = 'TREINADOR' limit 1", UUID.class, alunoA);
        api.delete("/comunidade/perfis/" + equipe + "/apelido", admin, 404);
        api.delete("/comunidade/perfis/" + UUID.randomUUID() + "/apelido", admin, 404);
        assertThat(meusDados(loginA).get("apelido").asString()).isEqualTo("Outro.Apelido");
    }

    // ---- LGPD ----

    @Test
    void exportacaoTrazOApelidoEAnonimizacaoEExclusaoDeContaOApagam() throws Exception {
        definir(loginA, APELIDO, 204);
        definir(loginB, "Beto.Apelido", 204);
        assertThat(api.get("/alunos/" + alunoA + "/exportacao", admin, 200).get("comunidade").get("apelido").asString())
                .isEqualTo(APELIDO);

        api.post("/aluno/conta/excluir", loginA, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(jdbc.queryForObject("select apelido from aluno where id = ?", String.class, alunoA)).isNull();

        api.patch("/alunos/" + alunoB + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoB + "/anonimizar", admin, Map.of("nomeConfirmado", "Beto Fictício Apelido"), 200);
        assertThat(jdbc.queryForObject("select apelido from aluno where id = ?", String.class, alunoB)).isNull();
    }

    // ---- limite ----

    @Test
    void definirApelidoPassaPeloLimiteDaComunidade() throws Exception {
        for (int i = 0; i < 120; i++) {
            definir(loginA, APELIDO, 204);
        }
        definir(loginA, APELIDO, 429);
        definir(loginB, APELIDO, 204);
    }

    private void concluirTreino(JsonNode aluno, ApiDeTeste.TreinoDeTeste treino) throws Exception {
        String versao = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", UUID.randomUUID().toString());
        sessao.put("planoVersaoId", versao);
        sessao.put("sessaoUid", treino.sessaoUid().toString());
        sessao.put("data", hoje.toString());
        sessao.put("concluida", true);
        sessao.put("resultado", "COMPLETA");
        sessao.put("duracaoSegundos", 3000);
        sessao.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/sessoes-concluidas", aluno, Map.of("registros", List.of(sessao)), 200);
    }
}
