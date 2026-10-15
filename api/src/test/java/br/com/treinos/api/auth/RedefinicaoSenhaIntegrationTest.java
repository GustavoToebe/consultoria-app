package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Esqueci a senha" de treinador e aluno pelas rotas HTTP, com o despacho de verdade do módulo (thread virtual): o e-mail
 * capturado traz o link com o token no fragmento, e redefinir derruba as sessões antigas.
 */
@AutoConfigureMockMvc
class RedefinicaoSenhaIntegrationTest extends AbstractIntegrationTest {

    private static final Pattern TOKEN = Pattern.compile("/redefinir-senha#token=([^\\s\"<]+)");
    private static final String SENHA_NOVA = "senha-nova-456";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate banco;

    private ApiDeTeste api;
    private String email;
    private JsonNode treinador;

    @BeforeEach
    void criarTreinador() throws Exception {
        api = new ApiDeTeste(mvc, json);
        email = ApiDeTeste.emailUnico("esqueci");
        treinador = api.cadastrarTreinador(email);
        EmailDeTeste.FALHAR.set(false);
    }

    @AfterEach
    void religarOEnvio() {
        EmailDeTeste.FALHAR.set(false);
    }

    @Test
    void treinadorRedefineComOLinkDoEmailEAsSessoesAntigasCaem() throws Exception {
        esqueci(email, 202);
        String token = aguardarToken(email);

        redefinir(token, SENHA_NOVA, null, 204);

        login(email, ApiDeTeste.SENHA, 401);
        assertThat(login(email, SENHA_NOVA, 200).path("accessToken").asString()).isNotBlank();
        // A sessão aberta antes da redefinição deixou de valer (versão das credenciais) e o refresh também.
        api.get("/eu", treinador, 401);
        refresh(treinador.path("refreshToken").asString(), 401);
        // Uso único.
        assertThat(redefinir(token, "outra-senha-789", null, 400).path("codigo").asString()).isEqualTo("LINK_INVALIDO");
        assertThat(banco.queryForObject("select count(*) from auditoria where acao='SENHA_REDEFINIDA' and usuario_id=?::uuid",
                Integer.class, treinador.path("usuario").path("id").asString())).isEqualTo(1);
    }

    @Test
    void alunoRedefineAMesmaSenhaPeloMesmoFluxo() throws Exception {
        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Teste"));
        String emailAluno = aluno.path("usuario").path("email").asString();

        esqueci(emailAluno, 202);
        redefinir(aguardarToken(emailAluno), SENHA_NOVA, null, 204);

        login(emailAluno, ApiDeTeste.SENHA, 401);
        assertThat(login(emailAluno, SENHA_NOVA, 200).path("usuario").path("papel").asString()).isEqualTo("ALUNO");
        api.get("/eu", aluno, 401);
    }

    @Test
    void emailDesconhecidoRecebeAMesmaRespostaENaoMandaNada() throws Exception {
        String desconhecido = ApiDeTeste.emailUnico("ninguem");
        MvcResult sem = esqueci(desconhecido, 202);
        MvcResult com = esqueci(email, 202);

        assertThat(sem.getResponse().getContentAsString()).isEqualTo(com.getResponse().getContentAsString());
        aguardarToken(email);
        assertThat(EmailDeTeste.para(desconhecido)).isEmpty();
    }

    @Test
    void contaDeConviteAindaNaoAceitoNaoRecebeLink() throws Exception {
        String perfil = api.get("/perfis", treinador, 200).get(0).path("id").asString();
        String convidado = ApiDeTeste.emailUnico("convidado");
        api.post("/usuarios/convites", treinador, Map.of("nome", "Convidado", "email", convidado, "perfilId", perfil), 200);
        // Quem ainda não tem conta não tem o que redefinir; o e-mail que existe é só o do convite.
        esqueci(convidado, 202);
        esqueci(email, 202);
        aguardarToken(email);
        assertThat(EmailDeTeste.para(convidado)).noneMatch(m -> m.assunto().startsWith("Redefinição"));
    }

    @Test
    void linkTrazOTokenNoFragmentoESoTextoFixo() throws Exception {
        esqueci(email, 202);
        aguardarToken(email);

        EnviadorDeEmail.Mensagem mensagem = EmailDeTeste.para(email).get(0);
        assertThat(mensagem.assunto()).isEqualTo("Redefinição de senha - Consultoria");
        assertThat(mensagem.texto()).contains("http://localhost:8088/redefinir-senha#token=")
                .doesNotContain("Treinador Teste").doesNotContain(email);
    }

    @Test
    void senhaRecusadaPelaRegraDoAppNaoGastaOLink() throws Exception {
        esqueci(email, 202);
        String token = aguardarToken(email);

        assertThat(redefinir(token, "curta", null, 400).path("message").asString()).contains("8 caracteres");
        assertThat(redefinir(token, email, null, 400).path("message").asString()).contains("igual ao e-mail");
        assertThat(redefinir(token, "é".repeat(37), null, 400).path("codigo").asString()).isEqualTo("SENHA_LONGA");
        login(email, ApiDeTeste.SENHA, 200);

        redefinir(token, SENHA_NOVA, null, 204);
        login(email, SENHA_NOVA, 200);
    }

    @Test
    void comMfaAtivoARedefinicaoExigeOCodigoENuncaOContorna() throws Exception {
        String segredo = api.post("/eu/mfa/preparar", treinador, Map.of("senha", ApiDeTeste.SENHA), 200).get("segredo").asString();
        JsonNode ativacao = api.post("/eu/mfa/ativar", treinador, Map.of("senha", ApiDeTeste.SENHA,
                "codigo", MfaIntegrationTest.codigo(segredo, Instant.now().getEpochSecond() / 30)), 200);
        String recuperacao = ativacao.get("codigosDeRecuperacao").get(0).asString();

        esqueci(email, 202);
        String token = aguardarToken(email);

        assertThat(redefinir(token, SENHA_NOVA, null, 401).path("codigo").asString()).isEqualTo("MFA_NECESSARIO");
        assertThat(redefinir(token, SENHA_NOVA, "000000", 401).path("codigo").asString()).isEqualTo("MFA_CODIGO_INVALIDO");
        login(email, ApiDeTeste.SENHA, 401);

        redefinir(token, SENHA_NOVA, recuperacao, 204);
        // O MFA continua ligado: a senha nova sozinha não basta para entrar.
        assertThat(login(email, SENHA_NOVA, 401).path("codigo").asString()).isEqualTo("MFA_NECESSARIO");
    }

    @Test
    void pedidosDemaisPorEmailDaoLimiteComRetryAfter() throws Exception {
        String conta = ApiDeTeste.emailUnico("limite");
        for (int i = 0; i < 5; i++) {
            esqueci(conta, 202);
        }
        MvcResult bloqueado = esqueci(conta, 429);
        assertThat(bloqueado.getResponse().getHeader(HttpHeaders.RETRY_AFTER)).isNotBlank();
        assertThat(api.ler(bloqueado).path("codigo").asString()).isEqualTo("LOGIN_LIMITADO");
        // O limite do e-mail não derruba o login de ninguém.
        login(email, ApiDeTeste.SENHA, 200);
    }

    @Test
    void falhaDoProvedorNaoApareceNaRespostaNemNoLog() throws Exception {
        EmailDeTeste.FALHAR.set(true);
        MvcResult resposta = esqueci(email, 202);

        assertThat(resposta.getResponse().getContentAsString()).isEmpty();
        assertThat(EmailDeTeste.para(email)).isEmpty();
    }

    @Test
    void conviteDeEquipeVaiPorEmailEOLinkContinuaNaResposta() throws Exception {
        String perfil = api.get("/perfis", treinador, 200).get(0).path("id").asString();
        String convidado = ApiDeTeste.emailUnico("equipe");

        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Nova Pessoa", "email", convidado, "perfilId", perfil), 200);

        assertThat(convite.path("emailEnviado").asBoolean()).isTrue();
        EnviadorDeEmail.Mensagem mensagem = EmailDeTeste.para(convidado).get(0);
        assertThat(mensagem.assunto()).isEqualTo("Convite - Consultoria");
        assertThat(mensagem.texto()).contains(convite.path("link").asString())
                .contains("/convite-equipe#" + convite.path("codigo").asString())
                .doesNotContain("Nova Pessoa");
        // O código do e-mail aceita o convite.
        api.post("/publico/convites-equipe/" + convite.path("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void conviteDeEquipeContinuaValendoSeOEmailFalhar() throws Exception {
        EmailDeTeste.FALHAR.set(true);
        String perfil = api.get("/perfis", treinador, 200).get(0).path("id").asString();
        String convidado = ApiDeTeste.emailUnico("equipe-falha");

        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Sem E-mail", "email", convidado, "perfilId", perfil), 200);

        assertThat(convite.path("emailEnviado").asBoolean()).isFalse();
        assertThat(convite.path("link").asString()).contains("/convite-equipe#");
        api.post("/publico/convites-equipe/" + convite.path("codigo").asString(), null,
                Map.of("senha", ApiDeTeste.SENHA), 200);
    }

    // ---- HTTP ----

    private MvcResult esqueci(String conta, int esperado) throws Exception {
        return mvc.perform(post("/auth/esqueci-senha").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("email", conta))))
                .andExpect(status().is(esperado)).andReturn();
    }

    private JsonNode redefinir(String token, String senha, String codigoMfa, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("token", token);
        corpo.put("novaSenha", senha);
        if (codigoMfa != null) {
            corpo.put("codigoMfa", codigoMfa);
        }
        MvcResult r = mvc.perform(post("/auth/redefinir-senha").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                .andExpect(status().is(esperado)).andReturn();
        return api.ler(r);
    }

    private JsonNode login(String conta, String senha, int esperado) throws Exception {
        MvcResult r = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", conta, "senha", senha))))
                .andExpect(status().is(esperado)).andReturn();
        return api.ler(r);
    }

    private void refresh(String refreshToken, int esperado) throws Exception {
        mvc.perform(post("/auth/refresh").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("refreshToken", refreshToken))))
                .andExpect(status().is(esperado));
    }

    /** O despacho é assíncrono (thread virtual do módulo): espera o e-mail de redefinição chegar ao provedor de teste. */
    private static String aguardarToken(String destinatario) {
        await().atMost(Duration.ofSeconds(15)).until(() -> EmailDeTeste.para(destinatario).stream()
                .anyMatch(m -> m.assunto().startsWith("Redefinição")));
        EnviadorDeEmail.Mensagem ultima = EmailDeTeste.para(destinatario).stream()
                .filter(m -> m.assunto().startsWith("Redefinição")).reduce((a, b) -> b).orElseThrow();
        Matcher m = TOKEN.matcher(ultima.texto());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }
}
