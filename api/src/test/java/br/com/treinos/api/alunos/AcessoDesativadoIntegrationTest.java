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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Acesso do aluno ao app pelo treinador (V100): trocar o e-mail de login, desativar e reativar o acesso, a convivência com a
 * situação do aluno, auditoria de resumo fixo e os avisos por e-mail. Só dados fictícios.
 */
@AutoConfigureMockMvc
class AcessoDesativadoIntegrationTest extends AbstractIntegrationTest {

    private static final String ASSUNTO_DO_AVISO = "E-mail de acesso alterado";

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

    private JsonNode login(String email, String senha, int esperado) throws Exception {
        MvcResult r = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(api.corpoLogin(email, senha)))
                .andExpect(status().is(esperado)).andReturn();
        return api.ler(r);
    }

    private void refresh(String refreshToken, int esperado) throws Exception {
        mvc.perform(post("/auth/refresh").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().is(esperado));
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

    private JsonNode ficha(UUID alunoId) throws Exception {
        return api.get("/alunos/" + alunoId, treinador, 200);
    }

    private static boolean semValor(JsonNode n) {
        return n.isMissingNode() || n.isNull();
    }

    private int eventos(String acao, UUID alunoId) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class,
                acao, alunoId.toString());
    }

    private boolean usuarioAtivo(UUID alunoId) {
        return Boolean.TRUE.equals(banco.queryForObject(
                "select u.ativo from usuario u join aluno a on a.usuario_id = u.id where a.id = ?::uuid", Boolean.class, alunoId.toString()));
    }

    private static String emailDe(JsonNode loginDoAluno) {
        return loginDoAluno.path("usuario").path("email").asString();
    }

    private JsonNode alterarEmail(JsonNode quem, UUID alunoId, String email, int esperado) throws Exception {
        return api.put("/alunos/" + alunoId + "/acesso/email", quem, Map.of("email", email), esperado);
    }

    private JsonNode desativar(JsonNode quem, UUID alunoId, int esperado) throws Exception {
        return api.post("/alunos/" + alunoId + "/acesso/desativar", quem, Map.of("motivo", "MANUAL"), esperado);
    }

    private JsonNode reativar(JsonNode quem, UUID alunoId, int esperado) throws Exception {
        return api.post("/alunos/" + alunoId + "/acesso/reativar", quem, null, esperado);
    }

    // ---- e-mail de acesso ----

    @Test
    void trocarOEmailDeAcessoMantemASenhaEncerraSessoesAvisaOsDoisEnderecosEAuditaSemEmail() throws Exception {
        String emailDoCadastro = ApiDeTeste.emailUnico("cadastro");
        UUID alunoId = UUID.fromString(api.post("/alunos", treinador, Map.of("nome", "Aluno Fictício", "email", emailDoCadastro), 200).get("id").asString());
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String antigo = emailDe(aluno);
        String novo = ApiDeTeste.emailUnico("novo-acesso");

        // O mesmo e-mail (com outra caixa) é 200 sem mexer em nada: a sessão continua e nada é auditado nem enviado.
        JsonNode mesmo = alterarEmail(treinador, alunoId, antigo.toUpperCase(Locale.ROOT), 200);
        assertThat(mesmo.path("emailEnviado").asBoolean(true)).as("mesmo e-mail: nada foi enviado").isFalse();
        assertThat(mesmo.path("aluno").path("emailDeAcesso").asString()).isEqualTo(antigo);
        api.get("/eu", aluno, 200);
        assertThat(eventos("ALUNO_EMAIL_DE_ACESSO_ALTERADO", alunoId)).isZero();

        JsonNode resposta = alterarEmail(treinador, alunoId, novo.toUpperCase(Locale.ROOT), 200);
        assertThat(resposta.path("emailEnviado").asBoolean()).as("o aviso ao e-mail novo foi entregue ao provedor").isTrue();
        JsonNode depois = resposta.path("aluno");
        assertThat(depois.path("emailDeAcesso").asString()).isEqualTo(novo);
        assertThat(depois.path("email").asString()).as("o e-mail do cadastro não muda").isEqualTo(emailDoCadastro);
        assertThat(depois.path("aguardandoPrimeiroAcesso").asBoolean()).isFalse();
        assertThat(depois.path("temAcesso").asBoolean()).isTrue();

        // Sessões encerradas, o e-mail antigo não entra mais e a senha do aluno continua a mesma.
        api.get("/eu", aluno, 401);
        refresh(aluno.path("refreshToken").asString(), 401);
        login(antigo, ApiDeTeste.SENHA, 401);
        assertThat(login(novo, ApiDeTeste.SENHA, 200).path("accessToken").asString()).isNotBlank();

        // Auditoria de resumo fixo, sem e-mail.
        List<Map<String, Object>> eventos = banco.queryForList(
                "select resumo, entidade, user_agent from auditoria where acao = 'ALUNO_EMAIL_DE_ACESSO_ALTERADO' and entidade_id = ?::uuid",
                alunoId.toString());
        assertThat(eventos).hasSize(1);
        assertThat(eventos.getFirst().get("resumo")).isEqualTo("Alterou o e-mail de acesso do aluno.");
        assertThat(eventos.getFirst().toString()).doesNotContain(antigo).doesNotContain(novo);

        // Um aviso para cada endereço, com texto fixo: nem e-mail nem nome do aluno.
        for (String para : List.of(antigo, novo)) {
            await().atMost(Duration.ofSeconds(15)).until(() -> avisos(para).size() == 1);
            EnviadorDeEmail.Mensagem aviso = avisos(para).getFirst();
            assertThat(aviso.texto() + aviso.html() + aviso.assunto()).doesNotContain(antigo).doesNotContain(novo)
                    .doesNotContain("Aluno Fictício").doesNotContain(emailDoCadastro);
        }
    }

    private static List<EnviadorDeEmail.Mensagem> avisos(String email) {
        return EmailDeTeste.para(email).stream().filter(m -> m.assunto().startsWith(ASSUNTO_DO_AVISO)).toList();
    }

    @Test
    void falhaDoProvedorDeEmailNaoDesfazATroca() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String novo = ApiDeTeste.emailUnico("provedor-fora");
        EmailDeTeste.FALHAR.set(true);
        try {
            JsonNode resposta = alterarEmail(treinador, alunoId, novo, 200);
            assertThat(resposta.path("aluno").path("emailDeAcesso").asString()).isEqualTo(novo);
            assertThat(resposta.path("emailEnviado").asBoolean(true)).as("provedor fora do ar: a troca vale, o aviso não saiu").isFalse();
        } finally {
            EmailDeTeste.FALHAR.set(false);
        }
        api.get("/eu", aluno, 401);
        assertThat(login(novo, ApiDeTeste.SENHA, 200).path("accessToken").asString()).isNotBlank();
    }

    @Test
    void recusasDoEmailDeAcesso() throws Exception {
        UUID semConta = api.criarAluno(treinador, "Sem Conta");
        UUID comConta = api.criarAluno(treinador, "Com Conta");
        api.convidarEEntrar(treinador, comConta);
        String doOutro = emailDe(api.convidarEEntrar(treinador, api.criarAluno(treinador, "Outro Aluno")));

        assertThat(alterarEmail(treinador, comConta, doOutro, 409).path("codigo").asString()).isEqualTo("EMAIL_EM_USO");
        assertThat(alterarEmail(treinador, semConta, ApiDeTeste.emailUnico("x"), 409).path("codigo").asString()).isEqualTo("ALUNO_SEM_ACESSO");
        alterarEmail(treinador, comConta, "nao-e-email", 400);
        alterarEmail(treinador, comConta, "", 400);
        alterarEmail(membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR")), comConta, ApiDeTeste.emailUnico("sem"), 403);
        alterarEmail(api.novoTreinador(), comConta, ApiDeTeste.emailUnico("outra"), 404);

        api.patch("/alunos/" + comConta + "/situacao", treinador, Map.of("ativo", false), 200);
        assertThat(alterarEmail(treinador, comConta, ApiDeTeste.emailUnico("inativo"), 409).path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        api.post("/alunos/" + comConta + "/anonimizar", treinador, Map.of("nomeConfirmado", "Com Conta"), 200);
        assertThat(alterarEmail(treinador, comConta, ApiDeTeste.emailUnico("anonimo"), 409).path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- desativar e reativar ----

    @Test
    void desativarRecusaLoginENaoApagaNadaEReativarLibera() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String email = emailDe(aluno);
        assertThat(semValor(ficha(alunoId).path("acessoDesativadoEm"))).isTrue();

        JsonNode ficha = desativar(treinador, alunoId, 200);
        assertThat(ficha.path("acessoDesativadoEm").asString()).isNotBlank();
        assertThat(ficha.path("acessoDesativadoMotivo").asString()).isEqualTo("MANUAL");
        assertThat(ficha.path("temAcesso").asBoolean()).as("a conta continua existindo").isTrue();
        assertThat(ficha.path("ativo").asBoolean()).as("o aluno continua ativo").isTrue();
        assertThat(ficha.path("emailDeAcesso").asString()).isEqualTo(email);
        assertThat(usuarioAtivo(alunoId)).isFalse();

        api.get("/eu", aluno, 401);
        refresh(aluno.path("refreshToken").asString(), 401);
        login(email, ApiDeTeste.SENHA, 401);

        // Idempotente: nada é regravado nem auditado.
        String em = ficha.path("acessoDesativadoEm").asString();
        assertThat(desativar(treinador, alunoId, 200).path("acessoDesativadoEm").asString()).isEqualTo(em);
        assertThat(eventos("ALUNO_ACESSO_DESATIVADO", alunoId)).isEqualTo(1);

        JsonNode reativada = reativar(treinador, alunoId, 200);
        assertThat(semValor(reativada.path("acessoDesativadoEm"))).isTrue();
        assertThat(semValor(reativada.path("acessoDesativadoMotivo"))).isTrue();
        assertThat(usuarioAtivo(alunoId)).isTrue();
        assertThat(login(email, ApiDeTeste.SENHA, 200).path("accessToken").asString()).isNotBlank();
        // Reativar de novo: 200 sem mudar e sem auditar.
        reativar(treinador, alunoId, 200);
        assertThat(eventos("ALUNO_ACESSO_REATIVADO", alunoId)).isEqualTo(1);
    }

    @Test
    void auditoriaDeDesativarEReativarTemResumoFixo() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String email = emailDe(api.convidarEEntrar(treinador, alunoId));
        desativar(treinador, alunoId, 200);
        reativar(treinador, alunoId, 200);

        List<Map<String, Object>> eventos = banco.queryForList(
                "select acao, resumo, entidade from auditoria where acao in ('ALUNO_ACESSO_DESATIVADO', 'ALUNO_ACESSO_REATIVADO') and entidade_id = ?::uuid order by acao",
                alunoId.toString());
        assertThat(eventos).extracting(e -> e.get("resumo")).containsExactly("Desativou o acesso do aluno ao app.",
                "Reativou o acesso do aluno ao app.");
        assertThat(eventos).allSatisfy(e -> {
            assertThat(e.get("entidade")).isEqualTo("ALUNO");
            assertThat(e.toString()).doesNotContain(email).doesNotContain("MANUAL");
        });
    }

    @Test
    void motivoAusenteValeManualEOutroValorEhRecusado() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        api.convidarEEntrar(treinador, alunoId);

        api.post("/alunos/" + alunoId + "/acesso/desativar", treinador, Map.of("motivo", "OUTRO"), 400);
        assertThat(semValor(ficha(alunoId).path("acessoDesativadoEm"))).isTrue();
        // Sem corpo: o único motivo de hoje.
        assertThat(api.post("/alunos/" + alunoId + "/acesso/desativar", treinador, null, 200).path("acessoDesativadoMotivo").asString())
                .isEqualTo("MANUAL");
    }

    @Test
    void recusasDeDesativarEReativar() throws Exception {
        UUID semConta = api.criarAluno(treinador, "Sem Conta");
        UUID comConta = api.criarAluno(treinador, "Com Conta");
        api.convidarEEntrar(treinador, comConta);

        assertThat(desativar(treinador, semConta, 409).path("codigo").asString()).isEqualTo("ALUNO_SEM_ACESSO");
        reativar(treinador, semConta, 200); // nada a reativar: 200 sem mudar
        desativar(membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR")), comConta, 403);
        reativar(membro(Set.of("ALUNO_LER", "ALUNO_ALTERAR")), comConta, 403);
        desativar(api.novoTreinador(), comConta, 404);
        reativar(api.novoTreinador(), comConta, 404);
        assertThat(usuarioAtivo(comConta)).isTrue();

        api.patch("/alunos/" + comConta + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + comConta + "/anonimizar", treinador, Map.of("nomeConfirmado", "Com Conta"), 200);
        assertThat(desativar(treinador, comConta, 409).path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(reativar(treinador, comConta, 409).path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    // ---- acesso desativado × situação do aluno ----

    @Test
    void reativarOAlunoNaoReativaOAcessoDesativado() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String email = emailDe(api.convidarEEntrar(treinador, alunoId));
        desativar(treinador, alunoId, 200);

        // Inativar mantém as colunas; reativar o aluno não liga o usuário.
        JsonNode inativo = api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        assertThat(inativo.path("acessoDesativadoEm").asString()).isNotBlank();
        assertThat(reativar(treinador, alunoId, 409).path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        JsonNode ativo = api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", true), 200);
        assertThat(ativo.path("acessoDesativadoEm").asString()).isNotBlank();
        assertThat(usuarioAtivo(alunoId)).isFalse();
        login(email, ApiDeTeste.SENHA, 401);

        reativar(treinador, alunoId, 200);
        assertThat(login(email, ApiDeTeste.SENHA, 200).path("accessToken").asString()).isNotBlank();
    }

    @Test
    void semAcessoDesativadoReativarOAlunoContinuaLiberandoOLogin() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        String email = emailDe(api.convidarEEntrar(treinador, alunoId));

        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        login(email, ApiDeTeste.SENHA, 401);
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", true), 200);
        assertThat(login(email, ApiDeTeste.SENHA, 200).path("accessToken").asString()).isNotBlank();
    }

    @Test
    void definirAcessoEConviteComAcessoDesativado() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        api.convidarEEntrar(treinador, alunoId);
        desativar(treinador, alunoId, 200);

        JsonNode definir = api.put("/alunos/" + alunoId + "/acesso", treinador,
                Map.of("email", ApiDeTeste.emailUnico("definir"), "senha", "provisoria-123"), 409);
        assertThat(definir.path("codigo").asString()).isEqualTo("ACESSO_DESATIVADO");
        assertThat(definir.path("message").asString()).isEqualTo("Reative o acesso antes.");
        // A conta existe: convite novo não faz sentido, como com o acesso ativo.
        assertThat(api.post("/alunos/" + alunoId + "/convite", treinador, null, 409).path("codigo").asString()).isEqualTo("ALUNO_COM_ACESSO");
        // Trocar o e-mail de login com o acesso desativado vale (o aluno só volta a entrar depois de reativar).
        String novo = ApiDeTeste.emailUnico("desativado");
        alterarEmail(treinador, alunoId, novo, 200);
        login(novo, ApiDeTeste.SENHA, 401);
        reativar(treinador, alunoId, 200);
        assertThat(login(novo, ApiDeTeste.SENHA, 200).path("accessToken").asString()).isNotBlank();
    }

    @Test
    void anonimizarLimpaAsColunasDoAcessoDesativado() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        api.convidarEEntrar(treinador, alunoId);
        desativar(treinador, alunoId, 200);
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);

        JsonNode anonimo = api.post("/alunos/" + alunoId + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Fictício"), 200);
        assertThat(semValor(anonimo.path("acessoDesativadoEm"))).isTrue();
        assertThat(semValor(anonimo.path("acessoDesativadoMotivo"))).isTrue();
        assertThat(banco.queryForObject("select count(*) from aluno where id = ?::uuid and acesso_desativado_em is null and acesso_desativado_motivo is null",
                Integer.class, alunoId.toString())).isEqualTo(1);
    }

    @Test
    void exportacaoDoAlunoLevaOAcessoDesativado() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        api.convidarEEntrar(treinador, alunoId);
        desativar(treinador, alunoId, 200);

        JsonNode cadastro = api.get("/alunos/" + alunoId + "/exportacao", treinador, 200).path("cadastro");
        assertThat(cadastro.path("acessoDesativadoEm").asString()).isNotBlank();
        assertThat(cadastro.path("acessoDesativadoMotivo").asString()).isEqualTo("MANUAL");
    }
}
