package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pausa por atraso (ATRASO, V104) junto da desativação manual (MANUAL, V100), no mesmo par de colunas: o MANUAL nunca é
 * reativado ao quitar nem pela rota do Financeiro; pausar quem está MANUAL é 409 {@code ACESSO_JA_DESATIVADO}; desativar quem
 * está em ATRASO troca para MANUAL e derruba o login; ATRASO sobrevive a inativar e reativar o aluno sem bloquear o login; e
 * as corridas (pausar x desativar, quitar x desativar) sempre terminam em MANUAL com o login bloqueado. Só dados fictícios.
 */
@AutoConfigureMockMvc
class AtrasoEManualIntegrationTest extends AbstractIntegrationTest {

    private static final String MENSAGEM_JA_DESATIVADO =
            "O acesso deste aluno foi desativado pela equipe. Só \"Reativar acesso\", em Acesso ao app, o libera.";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoriaId;
    private ExecutorService pool;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        consultoriaId = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.get("usuario").get("id").asString());
        pool = Executors.newFixedThreadPool(2);
    }

    @AfterEach
    void desligar() {
        pool.shutdownNow();
    }

    @Test
    void manualNuncaEReativadoAoQuitarNemPelaRotaDoFinanceiro() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Manual Quita");
        String email = emailDe(api.convidarEEntrar(treinador, alunoId));
        JsonNode cobranca = criarCobrancaAvulsa(alunoId, hoje.minusDays(10));

        assertThat(desativar(alunoId, 200).get("acessoDesativadoMotivo").asString()).isEqualTo("MANUAL");
        login(email, 401);

        api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", treinador,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", cobranca.get("versao").asLong()), 200);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("MANUAL");
        assertThat(usuarioAtivo(alunoId)).isFalse();
        assertThat(eventos("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoId)).isZero();
        login(email, 401);

        JsonNode recusa = api.post("/alunos/" + alunoId + "/reativar-acesso", treinador, null, 409);
        assertThat(recusa.get("codigo").asString()).isEqualTo("ACESSO_JA_DESATIVADO");
        assertThat(recusa.get("message").asString()).isEqualTo(MENSAGEM_JA_DESATIVADO);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("MANUAL");
        assertThat(eventos("ALUNO_ACESSO_REATIVADO", alunoId)).isZero();
    }

    @Test
    void pausarQuemEstaManualDa409SemMudarNada() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Manual Pausa");
        api.convidarEEntrar(treinador, alunoId);
        criarCobrancaAvulsa(alunoId, hoje.minusDays(10));
        String em = desativar(alunoId, 200).get("acessoDesativadoEm").asString();

        JsonNode recusa = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 409);
        assertThat(recusa.get("codigo").asString()).isEqualTo("ACESSO_JA_DESATIVADO");
        assertThat(recusa.get("message").asString()).isEqualTo(MENSAGEM_JA_DESATIVADO);
        JsonNode ficha = api.get("/alunos/" + alunoId, treinador, 200);
        assertThat(ficha.get("acessoDesativadoMotivo").asString()).isEqualTo("MANUAL");
        assertThat(ficha.get("acessoDesativadoEm").asString()).isEqualTo(em);
        assertThat(eventos("ALUNO_ACESSO_PAUSADO", alunoId)).isZero();
        // O corpo do /acesso/desativar não abre a porta do ATRASO (a pausa tem rota e permissão próprias).
        assertThat(status("/alunos/" + alunoId + "/acesso/desativar", Map.of("motivo", "ATRASO"))).isIn(400, 422);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("MANUAL");
    }

    @Test
    void desativarManualTrocaAtrasoPorManualEDerrubaOLogin() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Atraso Vira Manual");
        JsonNode sessao = api.convidarEEntrar(treinador, alunoId);
        String email = emailDe(sessao);
        JsonNode cobranca = criarCobrancaAvulsa(alunoId, hoje.minusDays(10));

        String emDaPausa = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200).get("acessoDesativadoEm").asString();
        api.get("/eu", sessao, 200);
        JsonNode outraSessao = login(email, 200);

        JsonNode desativado = desativar(alunoId, 200);
        assertThat(desativado.get("acessoDesativadoMotivo").asString()).isEqualTo("MANUAL");
        assertThat(desativado.get("acessoDesativadoEm").asString()).isNotEqualTo(emDaPausa);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("MANUAL");
        assertThat(usuarioAtivo(alunoId)).isFalse();
        assertThat(eventos("ALUNO_ACESSO_DESATIVADO", alunoId)).isEqualTo(1);
        api.get("/eu", sessao, 401);
        api.get("/eu", outraSessao, 401);
        api.post("/auth/refresh", null, Map.of("refreshToken", outraSessao.get("refreshToken").asString()), 401);
        login(email, 401);

        // Quitar depois não volta a liberar nada.
        api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", treinador,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", cobranca.get("versao").asLong()), 200);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("MANUAL");
        login(email, 401);

        // Só o "Reativar acesso" do cartão libera.
        assertThat(api.post("/alunos/" + alunoId + "/acesso/reativar", treinador, null, 200).get("acessoDesativadoMotivo").isNull()).isTrue();
        assertThat(usuarioAtivo(alunoId)).isTrue();
        login(email, 200);
    }

    @Test
    void atrasoSobreviveAInativarEReativarOAlunoSemBloquearOLogin() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Atraso Inativa");
        String email = emailDe(api.convidarEEntrar(treinador, alunoId));
        criarCobrancaAvulsa(alunoId, hoje.minusDays(10));
        api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200);

        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("ATRASO");
        login(email, 401);

        JsonNode reativado = api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", true), 200);
        assertThat(reativado.get("acessoDesativadoMotivo").asString()).isEqualTo("ATRASO");
        assertThat(motivoNoBanco(alunoId)).isEqualTo("ATRASO");
        assertThat(usuarioAtivo(alunoId)).isTrue();
        JsonNode sessao = login(email, 200);
        assertThat(api.get("/aluno/painel", sessao, 403).get("codigo").asString()).isEqualTo("ACESSO_PAUSADO_POR_ATRASO");
        api.get("/aluno/financeiro", sessao, 200);
    }

    @Test
    void definirAcessoMantemAPausaEReativarDoCartaoATiraSemMexerNoUsuario() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Atraso Cartao");
        api.convidarEEntrar(treinador, alunoId);
        criarCobrancaAvulsa(alunoId, hoje.minusDays(10));
        api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200);

        // Com ATRASO, definir e-mail e senha provisória vale (só o MANUAL pede "Reative o acesso antes") e não tira a pausa.
        String novo = ApiDeTeste.emailUnico("atraso-definir");
        api.put("/alunos/" + alunoId + "/acesso", treinador, Map.of("email", novo, "senha", "provisoria-123"), 200);
        assertThat(motivoNoBanco(alunoId)).isEqualTo("ATRASO");

        JsonNode reativado = api.post("/alunos/" + alunoId + "/acesso/reativar", treinador, null, 200);
        assertThat(reativado.get("acessoDesativadoMotivo").isNull()).isTrue();
        assertThat(reativado.get("acessoDesativadoEm").isNull()).isTrue();
        assertThat(motivoNoBanco(alunoId)).isNull();
        assertThat(usuarioAtivo(alunoId)).isTrue();
        assertThat(eventos("ALUNO_ACESSO_REATIVADO", alunoId)).isEqualTo(1);
    }

    @Test
    void corridasComODesativarManualTerminamSempreEmManualComOLoginBloqueado() throws Exception {
        for (int i = 0; i < 4; i++) {
            // Pausar x desativar ao mesmo tempo: a trava do aluno põe um depois do outro; nas duas ordens, MANUAL.
            UUID alunoId = api.criarAluno(treinador, "Aluno Corrida Pausa " + i);
            JsonNode sessao = api.convidarEEntrar(treinador, alunoId);
            criarCobrancaAvulsa(alunoId, hoje.minusDays(10));
            List<Integer> status = juntos(
                    () -> status("/alunos/" + alunoId + "/pausar-acesso", null),
                    () -> status("/alunos/" + alunoId + "/acesso/desativar", Map.of("motivo", "MANUAL")));
            assertThat(status.get(0)).isIn(200, 409);
            assertThat(status.get(1)).isEqualTo(200);
            assertThat(motivoNoBanco(alunoId)).isEqualTo("MANUAL");
            assertThat(usuarioAtivo(alunoId)).isFalse();
            login(emailDe(sessao), 401);

            // Quitar x desativar com o aluno em ATRASO: nunca termina liberado.
            UUID outro = api.criarAluno(treinador, "Aluno Corrida Quita " + i);
            JsonNode sessaoOutro = api.convidarEEntrar(treinador, outro);
            JsonNode cobranca = criarCobrancaAvulsa(outro, hoje.minusDays(10));
            api.post("/alunos/" + outro + "/pausar-acesso", treinador, null, 200);
            List<Integer> status2 = juntos(
                    () -> status("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual",
                            Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", cobranca.get("versao").asLong())),
                    () -> status("/alunos/" + outro + "/acesso/desativar", Map.of("motivo", "MANUAL")));
            assertThat(status2).containsExactly(200, 200);
            assertThat(motivoNoBanco(outro)).isEqualTo("MANUAL");
            assertThat(usuarioAtivo(outro)).isFalse();
            login(emailDe(sessaoOutro), 401);
        }
    }

    // ---- apoio ----

    private List<Integer> juntos(Callable<Integer> a, Callable<Integer> b) throws Exception {
        CountDownLatch largada = new CountDownLatch(1);
        Future<Integer> fa = pool.submit(() -> { largada.await(); return a.call(); });
        Future<Integer> fb = pool.submit(() -> { largada.await(); return b.call(); });
        largada.countDown();
        return List.of(fa.get(30, TimeUnit.SECONDS), fb.get(30, TimeUnit.SECONDS));
    }

    /** POST do treinador sem conferir o status (na corrida, o esperado depende de quem chega primeiro). */
    private int status(String caminho, Object corpo) throws Exception {
        var req = MockMvcRequestBuilders.post(caminho).header("X-Treinos-Cliente", "nativo")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador));
        if (corpo != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo));
        }
        return mvc.perform(req).andReturn().getResponse().getStatus();
    }

    private JsonNode desativar(UUID alunoId, int esperado) throws Exception {
        return api.post("/alunos/" + alunoId + "/acesso/desativar", treinador, Map.of("motivo", "MANUAL"), esperado);
    }

    private JsonNode login(String email, int esperado) throws Exception {
        return api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), esperado);
    }

    private static String emailDe(JsonNode sessaoDoAluno) {
        return sessaoDoAluno.path("usuario").path("email").asString();
    }

    private String motivoNoBanco(UUID alunoId) {
        return jdbc.queryForObject("select acesso_desativado_motivo from aluno where id = ?", String.class, alunoId);
    }

    private boolean usuarioAtivo(UUID alunoId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select u.ativo from usuario u join aluno a on a.usuario_id = u.id where a.id = ?", Boolean.class, alunoId));
    }

    private int eventos(String acao, UUID alunoId) {
        Integer n = jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = ? and entidade_id = ?",
                Integer.class, consultoriaId, acao, alunoId);
        return n == null ? 0 : n;
    }

    private JsonNode criarCobrancaAvulsa(UUID alunoId, LocalDate vencimento) throws Exception {
        api.post("/financeiro/cobrancas-avulsas", treinador, Map.of(
                "pedidoId", UUID.randomUUID().toString(),
                "alunoIds", List.of(alunoId.toString()),
                "descricao", "Cobrança teste",
                "valorCentavos", 10_000,
                "primeiroVencimento", vencimento.toString(),
                "parcelas", 1), 201);
        return api.get("/alunos/" + alunoId + "/cobrancas", treinador, 200).get(0);
    }
}
