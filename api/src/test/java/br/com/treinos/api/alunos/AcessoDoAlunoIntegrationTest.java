package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Acesso definido pelo treinador ({@code PUT /alunos/{id}/acesso}): senha provisória com troca obrigatória no primeiro
 * login, sessões derrubadas para quem já tinha conta, recusas e auditoria sem senha nem e-mail. Só dados fictícios.
 */
@AutoConfigureMockMvc
class AcessoDoAlunoIntegrationTest extends AbstractIntegrationTest {

    private static final String PROVISORIA = "provisoria-123";
    private static final String DO_ALUNO = "senha-do-aluno-456";
    private static final Pattern TOKEN = Pattern.compile("/redefinir-senha#token=([^\\s\"<]+)");

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        EmailDeTeste.FALHAR.set(false);
    }

    // ---- apoio ----

    private JsonNode definir(JsonNode quem, UUID alunoId, String email, String senha, int esperado) throws Exception {
        return api.put("/alunos/" + alunoId + "/acesso", quem, Map.of("email", email, "senha", senha), esperado);
    }

    private JsonNode login(String email, String senha, String novaSenha, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("email", email);
        corpo.put("senha", senha);
        if (novaSenha != null) corpo.put("novaSenha", novaSenha);
        MvcResult r = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                .andExpect(status().is(esperado)).andReturn();
        return api.ler(r);
    }

    private void refresh(String refreshToken, int esperado) throws Exception {
        mvc.perform(post("/auth/refresh").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().is(esperado));
    }

    private static boolean semValor(JsonNode n) {
        return n.isMissingNode() || n.isNull();
    }

    private boolean trocarSenha(UUID alunoId) {
        return Boolean.TRUE.equals(banco.queryForObject(
                "select u.trocar_senha from usuario u join aluno a on a.usuario_id = u.id where a.id = ?::uuid",
                Boolean.class, alunoId.toString()));
    }

    private String usuarioDoAluno(UUID alunoId) {
        return banco.queryForObject("select usuario_id::text from aluno where id = ?::uuid", String.class, alunoId.toString());
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

    private static String aguardarToken(String destinatario) {
        await().atMost(Duration.ofSeconds(15)).until(() -> EmailDeTeste.para(destinatario).stream()
                .anyMatch(m -> m.assunto().startsWith("Redefinição")));
        EnviadorDeEmail.Mensagem ultima = EmailDeTeste.para(destinatario).stream()
                .filter(m -> m.assunto().startsWith("Redefinição")).reduce((a, b) -> b).orElseThrow();
        Matcher m = TOKEN.matcher(ultima.texto());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    // ---- aluno sem conta ----

    @Test
    void alunoSemContaGanhaAcessoComSenhaProvisoriaEOConviteAntigoDeixaDeValer() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String codigo = api.post("/alunos/" + alunoId + "/convite", treinador, null, 200).get("codigo").asString();
        String email = ApiDeTeste.emailUnico("acesso");

        JsonNode ficha = definir(treinador, alunoId, email.toUpperCase(Locale.ROOT), PROVISORIA, 200);

        assertThat(ficha.path("temAcesso").asBoolean()).isTrue();
        assertThat(ficha.path("aguardandoPrimeiroAcesso").asBoolean()).isTrue();
        assertThat(ficha.path("emailDeAcesso").asString()).isEqualTo(email);
        assertThat(semValor(ficha.path("email"))).isTrue(); // o e-mail do cadastro não muda
        assertThat(semValor(ficha.path("conviteExpiraEm"))).isTrue();
        api.post("/publico/convites/consultar", null, Map.of("codigo", codigo), 404);
        // Com acesso, convite novo não faz mais sentido.
        assertThat(api.post("/alunos/" + alunoId + "/convite", treinador, null, 409).path("codigo").asString())
                .isEqualTo("ALUNO_COM_ACESSO");
    }

    @Test
    void primeiroLoginPedeSenhaNovaAntesDeAbrirASessao() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String email = ApiDeTeste.emailUnico("primeiro");
        definir(treinador, alunoId, email, PROVISORIA, 200);

        JsonNode semNova = login(email, PROVISORIA, null, 401);
        assertThat(semNova.path("codigo").asString()).isEqualTo("TROCA_DE_SENHA_NECESSARIA");
        assertThat(semNova.path("accessToken").isMissingNode()).isTrue();
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'LOGIN_SUCESSO' and usuario_id = ?::uuid",
                Integer.class, usuarioDoAluno(alunoId))).isZero();

        login(email, PROVISORIA, PROVISORIA, 400);
        login(email, PROVISORIA, "curta", 400);
        login(email, "senha-errada-999", DO_ALUNO, 401);
        assertThat(trocarSenha(alunoId)).isTrue();

        JsonNode sessao = login(email, PROVISORIA, DO_ALUNO, 200);
        assertThat(sessao.path("accessToken").asString()).isNotBlank();
        assertThat(api.get("/eu", sessao, 200).path("usuario").path("papel").asString()).isEqualTo("ALUNO");
        assertThat(api.get("/alunos/" + alunoId, treinador, 200).path("aguardandoPrimeiroAcesso").asBoolean()).isFalse();
        assertThat(trocarSenha(alunoId)).isFalse();
        refresh(sessao.path("refreshToken").asString(), 200);

        login(email, PROVISORIA, null, 401);
        assertThat(login(email, DO_ALUNO, null, 200).path("accessToken").asString()).isNotBlank();
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'SENHA_ALTERADA' and usuario_id = ?::uuid",
                Integer.class, usuarioDoAluno(alunoId))).isEqualTo(1);
    }

    // ---- aluno com conta ----

    @Test
    void alunoComContaPerdeAsSessoesEPrecisaDaSenhaNova() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String email = aluno.path("usuario").path("email").asString();

        // Mesmo e-mail (com outra caixa) não é "e-mail em uso" pela própria conta.
        JsonNode ficha = definir(treinador, alunoId, email.toUpperCase(Locale.ROOT), PROVISORIA, 200);
        assertThat(ficha.path("aguardandoPrimeiroAcesso").asBoolean()).isTrue();
        assertThat(ficha.path("emailDeAcesso").asString()).isEqualTo(email);

        refresh(aluno.path("refreshToken").asString(), 401);
        api.get("/eu", aluno, 401);
        login(email, ApiDeTeste.SENHA, null, 401);
        assertThat(login(email, PROVISORIA, null, 401).path("codigo").asString()).isEqualTo("TROCA_DE_SENHA_NECESSARIA");
    }

    @Test
    void alunoComContaPodeTrocarOEmailDeAcesso() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String antigo = aluno.path("usuario").path("email").asString();
        String novo = ApiDeTeste.emailUnico("novo");

        assertThat(definir(treinador, alunoId, novo, PROVISORIA, 200).path("emailDeAcesso").asString()).isEqualTo(novo);

        login(antigo, PROVISORIA, null, 401);
        assertThat(login(novo, PROVISORIA, DO_ALUNO, 200).path("accessToken").asString()).isNotBlank();

        // Anonimizado: a ficha não mostra o marcador que ficou no lugar do e-mail de login.
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício"), 200);
        assertThat(semValor(api.get("/alunos/" + alunoId, treinador, 200).path("emailDeAcesso"))).isTrue();
    }

    // ---- recusas ----

    @Test
    void recusas() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String outroEmail = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Outro Aluno"))
                .path("usuario").path("email").asString();

        assertThat(definir(treinador, alunoId, outroEmail, PROVISORIA, 409).path("codigo").asString()).isEqualTo("EMAIL_EM_USO");
        definir(treinador, alunoId, ApiDeTeste.emailUnico("curta"), "curta", 400);
        definir(treinador, alunoId, "nao-e-email", PROVISORIA, 400);
        definir(membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR")), alunoId, ApiDeTeste.emailUnico("sem"), PROVISORIA, 403);
        definir(api.novoTreinador(), alunoId, ApiDeTeste.emailUnico("outra"), PROVISORIA, 404);
        assertThat(api.get("/alunos/" + alunoId, treinador, 200).path("temAcesso").asBoolean()).isFalse();

        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        JsonNode inativo = definir(treinador, alunoId, ApiDeTeste.emailUnico("inativo"), PROVISORIA, 409);
        assertThat(inativo.path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        assertThat(inativo.path("message").asString()).isEqualTo("Aluno inativo. Reative para dar acesso.");

        api.post("/alunos/" + alunoId + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício"), 200);
        assertThat(definir(treinador, alunoId, ApiDeTeste.emailUnico("anonimo"), PROVISORIA, 409).path("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- saídas que limpam a marca ----

    @Test
    void esqueciASenhaDesligaASenhaProvisoria() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String email = ApiDeTeste.emailUnico("esqueci");
        definir(treinador, alunoId, email, PROVISORIA, 200);

        mvc.perform(post("/auth/esqueci-senha").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("email", email))))
                .andExpect(status().is(202));
        mvc.perform(post("/auth/redefinir-senha").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", aguardarToken(email), "novaSenha", DO_ALUNO))))
                .andExpect(status().is(204));

        assertThat(trocarSenha(alunoId)).isFalse();
        assertThat(login(email, DO_ALUNO, null, 200).path("accessToken").asString()).isNotBlank();
    }

    @Test
    void trocarAPropriaSenhaDesligaAMarca() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        // Não acontece pelo app (definir a provisória derruba as sessões); aqui só se confere que a troca limpa a marca.
        banco.update("update usuario set trocar_senha = true where id = ?::uuid", usuarioDoAluno(alunoId));

        api.put("/eu/senha", aluno, Map.of("senhaAtual", ApiDeTeste.SENHA, "senhaNova", DO_ALUNO), 200);

        assertThat(trocarSenha(alunoId)).isFalse();
    }

    // ---- auditoria ----

    @Test
    void auditoriaTemResumoFixoSemSenhaNemEmail() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String email = ApiDeTeste.emailUnico("auditoria");
        definir(treinador, alunoId, email, PROVISORIA, 200);

        List<Map<String, Object>> eventos = banco.queryForList(
                "select resumo, entidade, user_agent from auditoria where acao = 'ALUNO_ACESSO_DEFINIDO' and entidade_id = ?::uuid",
                alunoId.toString());
        assertThat(eventos).hasSize(1);
        assertThat(eventos.getFirst().get("resumo")).isEqualTo("Definiu o acesso do aluno com senha provisória.");
        assertThat(eventos.getFirst().get("entidade")).isEqualTo("ALUNO");
        assertThat(eventos.getFirst().toString()).doesNotContain(PROVISORIA).doesNotContain(email);
    }
}
