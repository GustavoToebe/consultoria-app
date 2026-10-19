package br.com.treinos.api.auth;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Turnstile ligado (siteverify de mentira, sem rede): cadastro de treinador, login e "esqueci a senha" exigem o token antes
 * de qualquer outra coisa; sem token ou com token recusado é 400 {@code VERIFICACAO_HUMANA}; Cloudflare fora é 503
 * (falha fechada); o cabeçalho de cliente nativo não dispensa; as falhas contam no limite por IP. Cada teste usa o seu IP,
 * porque o contador de falhas é por IP.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "treinos.turnstile.habilitado=true",
        "treinos.turnstile.site-key=1x00000000000000000000AA",
        "treinos.turnstile.segredo=1x0000000000000000000000000000000AA",
        "treinos.limites.verificacao-ip=3"})
class VerificacaoHumanaIntegrationTest extends AbstractIntegrationTest {

    private static final SiteverifyFalso FALSO = new SiteverifyFalso();

    @DynamicPropertySource
    static void siteverify(DynamicPropertyRegistry registry) {
        registry.add("treinos.turnstile.verify-url", FALSO::url);
    }

    @AfterAll
    static void descer() {
        FALSO.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void configuracaoPublicaDizQueEstaLigadaEMostraSoAChavePublica() throws Exception {
        MvcResult r = mvc.perform(get("/publico/configuracao")).andExpect(status().isOk()).andReturn();
        JsonNode corpo = json.readTree(r.getResponse().getContentAsString());
        assertThat(corpo.path("verificacaoHumana").asBoolean()).isTrue();
        assertThat(corpo.path("siteKey").asString()).isEqualTo("1x00000000000000000000AA");
        assertThat(corpo.path("cadastroAberto").asBoolean()).isTrue(); // a suíte abre o cadastro (application-test.yml)
        assertThat(r.getResponse().getContentAsString()).doesNotContain("1x0000000000000000000000000000000AA").doesNotContain("segredo");
    }

    @Test
    void cadastroSemTokenEBarradoSemChamarACloudflareENemCriarConta() throws Exception {
        int antes = FALSO.chamadas().size();
        String email = ApiDeTeste.emailUnico("sem-token");
        JsonNode erro = enviar("/auth/cadastro-treinador", cadastro(email, null), "198.51.100.11", 400);
        assertThat(erro.path("codigo").asString()).isEqualTo("VERIFICACAO_HUMANA");
        assertThat(FALSO.chamadas()).hasSize(antes);
        // a conta não nasceu: o mesmo e-mail cadastra depois, com token
        enviar("/auth/cadastro-treinador", cadastro(email, SiteverifyFalso.OK), "198.51.100.11", 200);
    }

    @Test
    void cadastroComTokenValidoPassaEMandaOIpRealEOSegredoAFonteDaVerificacao() throws Exception {
        int antes = FALSO.chamadas().size();
        enviar("/auth/cadastro-treinador", cadastro(ApiDeTeste.emailUnico("com-token"), SiteverifyFalso.OK), "198.51.100.12", 200);
        assertThat(FALSO.chamadas()).hasSize(antes + 1);
        assertThat(FALSO.chamadas().getLast()).containsEntry("remoteip", "198.51.100.12")
                .containsEntry("secret", "1x0000000000000000000000000000000AA").containsEntry("response", SiteverifyFalso.OK);
    }

    @Test
    void tokenRecusadoNoCadastroEBarrado() throws Exception {
        JsonNode erro = enviar("/auth/cadastro-treinador", cadastro(ApiDeTeste.emailUnico("ruim"), SiteverifyFalso.RUIM),
                "198.51.100.13", 400);
        assertThat(erro.path("codigo").asString()).isEqualTo("VERIFICACAO_HUMANA");
    }

    @Test
    void loginExigeOTokenAntesDeConferirASenha() throws Exception {
        String email = ApiDeTeste.emailUnico("login");
        enviar("/auth/cadastro-treinador", cadastro(email, SiteverifyFalso.OK), "198.51.100.14", 200);

        // senha errada e sem token: quem responde é a verificação (400), não a autenticação (401)
        assertThat(enviar("/auth/login", login(email, "senha-errada", null), "198.51.100.14", 400).path("codigo").asString())
                .isEqualTo("VERIFICACAO_HUMANA");
        // com token, a senha errada cai na autenticação
        enviar("/auth/login", login(email, "senha-errada", SiteverifyFalso.OK), "198.51.100.14", 401);
        // com token e senha certa, entra
        JsonNode sessao = enviar("/auth/login", login(email, ApiDeTeste.SENHA, SiteverifyFalso.OK), "198.51.100.14", 200);
        assertThat(sessao.path("accessToken").asString()).isNotBlank();
    }

    @Test
    void esqueciASenhaExigeOToken() throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("email", ApiDeTeste.emailUnico("esqueci"));
        assertThat(enviar("/auth/esqueci-senha", corpo, "198.51.100.15", 400).path("codigo").asString()).isEqualTo("VERIFICACAO_HUMANA");
        corpo.put("turnstileToken", SiteverifyFalso.OK);
        mvc.perform(post("/auth/esqueci-senha").header("X-Treinos-Cliente", "nativo").with(req -> {
            req.setRemoteAddr("198.51.100.15");
            return req;
        }).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo))).andExpect(status().isAccepted());
    }

    @Test
    void oCabecalhoDeClienteNativoNaoDispensaAVerificacao() throws Exception {
        // enviar() sempre manda X-Treinos-Cliente: nativo; sem token continua 400. E sem o cabeçalho (web) também.
        enviar("/auth/login", login("alguem@example.com", "qualquer-senha", null), "198.51.100.16", 400);
        mvc.perform(post("/auth/login").with(req -> {
            req.setRemoteAddr("198.51.100.17");
            return req;
        }).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(login("alguem@example.com", "qualquer-senha", null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cloudflareForaFalhaFechadoNasTresRotas() throws Exception {
        String email = ApiDeTeste.emailUnico("queda");
        for (String token : new String[] {SiteverifyFalso.QUEDA, SiteverifyFalso.SEGREDO_INVALIDO, SiteverifyFalso.LIXO}) {
            assertThat(enviar("/auth/cadastro-treinador", cadastro(email, token), "198.51.100.18", 503).path("codigo").asString())
                    .isEqualTo("VERIFICACAO_INDISPONIVEL");
            assertThat(enviar("/auth/login", login(email, ApiDeTeste.SENHA, token), "198.51.100.18", 503).path("codigo").asString())
                    .isEqualTo("VERIFICACAO_INDISPONIVEL");
            Map<String, Object> esqueci = new LinkedHashMap<>();
            esqueci.put("email", email);
            esqueci.put("turnstileToken", token);
            assertThat(enviar("/auth/esqueci-senha", esqueci, "198.51.100.18", 503).path("codigo").asString())
                    .isEqualTo("VERIFICACAO_INDISPONIVEL");
        }
        // o 503 não é falha da pessoa: não gastou o limite (nove 503 e a próxima com token bom passa)
        enviar("/auth/cadastro-treinador", cadastro(email, SiteverifyFalso.OK), "198.51.100.18", 200);
    }

    @Test
    void asFalhasContamNoLimiteEOIpBloqueadoNemChegaAACloudflare() throws Exception {
        String ip = "198.51.100.19";
        for (int i = 0; i < 2; i++) {
            enviar("/auth/login", login("alguem@example.com", "x", SiteverifyFalso.RUIM), ip, 400);
        }
        // a terceira falha (sem token) ainda é 400: o 429 vem na tentativa seguinte, que já encontra o limite gasto
        MvcResult cruzou = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo").with(req -> {
            req.setRemoteAddr(ip);
            return req;
        }).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(login("alguem@example.com", "x", null))))
                .andReturn();
        assertThat(cruzou.getResponse().getStatus()).isEqualTo(400);

        int antes = FALSO.chamadas().size();
        MvcResult bloqueada = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo").with(req -> {
            req.setRemoteAddr(ip);
            return req;
        }).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(login("alguem@example.com", "x", SiteverifyFalso.OK))))
                .andExpect(status().isTooManyRequests()).andReturn();
        assertThat(bloqueada.getResponse().getHeader("Retry-After")).isNotBlank();
        assertThat(FALSO.chamadas()).hasSize(antes);
    }

    @Test
    void oRefreshNaoPassaPelaVerificacao() throws Exception {
        // sem sessão: 401 SESSAO_EXPIRADA (a verificação responderia 400)
        enviar("/auth/refresh", Map.of("refreshToken", "token-que-nao-existe-0000000000000000"), "198.51.100.21", 401);
    }

    // ---- HTTP ----

    private JsonNode enviar(String caminho, Object corpo, String ip, int esperado) throws Exception {
        MvcResult r = mvc.perform(post(caminho).header("X-Treinos-Cliente", "nativo").with(req -> {
            req.setRemoteAddr(ip);
            return req;
        }).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                .andExpect(status().is(esperado)).andReturn();
        String texto = r.getResponse().getContentAsString();
        JsonNode corpoDaResposta = texto.isBlank() ? json.createObjectNode() : json.readTree(texto);
        if (esperado == 400 || esperado == 503) {
            // formato do erro que o app lê, sem token, segredo nem IP
            assertThat(corpoDaResposta.propertyNames()).containsExactlyInAnyOrder("timestamp", "status", "error", "message",
                    "codigo", "path", "requestId", "fieldErrors");
            assertThat(texto).doesNotContain("0000000000AA").doesNotContain("token-").doesNotContain(ip);
        }
        return corpoDaResposta;
    }

    private static Map<String, Object> cadastro(String email, String token) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nomeConsultoria", "Consultoria " + email);
        corpo.put("nome", "Treinador Teste");
        corpo.put("email", email);
        corpo.put("senha", ApiDeTeste.SENHA);
        if (token != null) {
            corpo.put("turnstileToken", token);
        }
        return corpo;
    }

    private static Map<String, Object> login(String email, String senha, String token) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("email", email);
        corpo.put("senha", senha);
        if (token != null) {
            corpo.put("turnstileToken", token);
        }
        return corpo;
    }
}
