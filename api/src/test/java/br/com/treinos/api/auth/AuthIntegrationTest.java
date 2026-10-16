package br.com.treinos.api.auth;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Seção 15.1, item 1: login, limite, rotação do refresh, reuso, troca de senha e CSRF da web. */
@AutoConfigureMockMvc
class AuthIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private String email;

    @BeforeEach
    void criarTreinador() throws Exception {
        api = new ApiDeTeste(mvc, json);
        email = ApiDeTeste.emailUnico("treinador");
        api.cadastrarTreinador(email);
    }

    @Test
    void loginWebRecebeCookieHttpOnlyESemRefreshNoCorpo() throws Exception {
        MvcResult r = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.usuario.papel").value("TREINADOR"))
                .andExpect(jsonPath("$.marca.nome").value("Consultoria " + email))
                .andReturn();
        String setCookie = r.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(c -> c.startsWith("TREINOS_REFRESH=")).findFirst().orElseThrow();
        assertThat(setCookie).contains("HttpOnly").contains("Secure").contains("SameSite=Strict").contains("Path=/auth");
    }

    @Test
    void loginNativoRecebeRefreshNoCorpoESemCookie() throws Exception {
        MvcResult r = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();
        assertThat(r.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .noneMatch(c -> c.startsWith("TREINOS_REFRESH="));
    }

    @Test
    void senhaErradaEEmailInexistenteTemAMesmaResposta() throws Exception {
        String erro1 = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(email, "senha-errada-123")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIAIS_INVALIDAS"))
                .andReturn().getResponse().getContentAsString();
        String erro2 = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(ApiDeTeste.emailUnico("ninguem"), "senha-errada-123")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("CREDENCIAIS_INVALIDAS"))
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(erro1).get("message")).isEqualTo(json.readTree(erro2).get("message"));
    }

    @Test
    void bloqueioDeLoginViraUmaLinhaDeAuditoriaPorJanelaENaoUmaPorTentativa() throws Exception {
        String conta = ApiDeTeste.emailUnico("bloqueada");
        JsonNode dono = api.cadastrarTreinador(conta);
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(api.corpoLogin(conta, "senha-errada-123"))).andExpect(status().isUnauthorized());
        }
        for (int i = 0; i < 6; i++) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(api.corpoLogin(conta, "senha-errada-123"))).andExpect(status().isTooManyRequests());
        }
        assertThat(api.get("/auditoria?acao=LOGIN_BLOQUEADO", dono, 200).path("itens")).hasSize(1);
    }

    @Test
    void decimaPrimeiraTentativaNaMesmaContaRecebe429ComRetryAfter() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(api.corpoLogin(email, "senha-errada-123")))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.codigo").value("LOGIN_LIMITADO"))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER));
    }

    @Test
    void refreshRotacionaEReusoDerrubaTodasAsSessoes() throws Exception {
        JsonNode login = loginNativo();
        String primeiro = login.get("refreshToken").asString();

        JsonNode renovado = refreshNativo(primeiro, 200);
        String segundo = renovado.get("refreshToken").asString();
        assertThat(segundo).isNotEqualTo(primeiro);

        // O primeiro já foi usado: apresentar de novo é reuso (roubo) e derruba tudo, inclusive o segundo.
        refreshNativo(primeiro, 401);
        refreshNativo(segundo, 401);
    }

    @Test
    void logoutRevogaORefresh() throws Exception {
        String refresh = loginNativo().get("refreshToken").asString();
        mvc.perform(post("/auth/logout").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(api.paraJson(Map.of("refreshToken", refresh))))
                .andExpect(status().isNoContent());
        refreshNativo(refresh, 401);
    }

    @Test
    void trocaDeSenhaDerrubaOBearerAntigoNaHora() throws Exception {
        JsonNode login = loginNativo();
        String antigo = ApiDeTeste.bearer(login);
        mvc.perform(get("/eu").header(HttpHeaders.AUTHORIZATION, antigo)).andExpect(status().isOk());

        MvcResult r = mvc.perform(put("/eu/senha").header(HttpHeaders.AUTHORIZATION, antigo)
                        .header("X-Treinos-Cliente", "nativo").contentType(MediaType.APPLICATION_JSON)
                        .content(api.paraJson(Map.of("senhaAtual", ApiDeTeste.SENHA, "senhaNova", "outra-senha-456"))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode novaSessao = api.ler(r);

        mvc.perform(get("/eu").header(HttpHeaders.AUTHORIZATION, antigo))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("SESSAO_EXPIRADA"));
        mvc.perform(get("/eu").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(novaSessao)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario.email").value(email));
        // O refresh de antes da troca não vale mais; o novo vale.
        refreshNativo(login.get("refreshToken").asString(), 401);
    }

    @Test
    void trocaDeSenhaConfereASenhaAtual() throws Exception {
        mvc.perform(put("/eu/senha").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginNativo()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(api.paraJson(Map.of("senhaAtual", "nao-e-esta-123", "senhaNova", "outra-senha-456"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DADOS_INVALIDOS"));
    }

    @Test
    void trocaDeSenhaGravaAuditoriaSemValores() throws Exception {
        JsonNode nova = api.put("/eu/senha", loginNativo(), Map.of("senhaAtual", ApiDeTeste.SENHA, "senhaNova", "outra-senha-456"), 200);
        JsonNode itens = api.get("/auditoria?acao=SENHA_ALTERADA", nova, 200).path("itens");
        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).path("resumo").asString()).isEqualTo("Trocou a própria senha.");
        assertThat(itens.toString()).doesNotContain("outra-senha-456").doesNotContain(ApiDeTeste.SENHA);
    }

    @Test
    void trocaDeSenhaPassaPeloLimiteDeTentativas() throws Exception {
        JsonNode login = loginNativo();
        int tentativas = 0;
        MvcResult ultima;
        do {
            ultima = mvc.perform(put("/eu/senha").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))
                            .header("X-Treinos-Cliente", "nativo").contentType(MediaType.APPLICATION_JSON)
                            .content(api.paraJson(Map.of("senhaAtual", "nao-e-esta-123", "senhaNova", "outra-senha-456"))))
                    .andReturn();
        } while (ultima.getResponse().getStatus() == 400 && ++tentativas < 20);
        assertThat(tentativas).isBetween(5, 15);
        assertThat(ultima.getResponse().getStatus()).isEqualTo(429);
        assertThat(ultima.getResponse().getHeader(HttpHeaders.RETRY_AFTER)).isNotBlank();
        assertThat(ultima.getResponse().getContentAsString()).contains("LOGIN_LIMITADO");
        // Bloqueado, nem a senha certa passa.
        mvc.perform(put("/eu/senha").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))
                        .header("X-Treinos-Cliente", "nativo").contentType(MediaType.APPLICATION_JSON)
                        .content(api.paraJson(Map.of("senhaAtual", ApiDeTeste.SENHA, "senhaNova", "outra-senha-456"))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void refreshWebExigeCsrfQuandoVemOCookie() throws Exception {
        MvcResult login = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk()).andReturn();
        Cookie refresh = login.getResponse().getCookie("TREINOS_REFRESH");
        assertThat(refresh).isNotNull();

        mvc.perform(post("/auth/refresh").cookie(refresh))
                .andExpect(status().isForbidden());

        // Double submit: o app lê o cookie TREINOS-XSRF-TOKEN e repete o valor no header.
        Cookie xsrf = new Cookie("TREINOS-XSRF-TOKEN", "token-xsrf-de-teste");
        mvc.perform(post("/auth/refresh").cookie(refresh, xsrf).header("X-XSRF-TOKEN", "token-xsrf-de-teste"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void loginWebEntregaOCookieCsrfParaOApp() throws Exception {
        MvcResult r = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk()).andReturn();
        assertThat(r.getResponse().getCookie("TREINOS-XSRF-TOKEN")).isNotNull();
    }

    @Test
    void navegadorReabertoGanhaOCookieCsrfPeloHealthEORefreshPassa() throws Exception {
        MvcResult login = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk()).andReturn();
        Cookie refresh = login.getResponse().getCookie("TREINOS_REFRESH");
        assertThat(refresh).isNotNull();

        // O cookie XSRF é de sessão do navegador: reaberto, só o refresh sobrou. O app pede /actuator/health para ganhar outro.
        MvcResult health = mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andReturn();
        Cookie xsrf = health.getResponse().getCookie("TREINOS-XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        assertThat(xsrf.getValue()).isNotBlank();

        mvc.perform(post("/auth/refresh").cookie(refresh, xsrf).header("X-XSRF-TOKEN", xsrf.getValue()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void cadastroComEmailJaUsadoRecebe409() throws Exception {
        mvc.perform(post("/auth/cadastro-treinador").contentType(MediaType.APPLICATION_JSON)
                        .content(api.paraJson(Map.of("nomeConsultoria", "Outra", "nome", "Outro", "email",
                                email.toUpperCase(java.util.Locale.ROOT), "senha", ApiDeTeste.SENHA))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("EMAIL_EM_USO"));
    }

    @Test
    void cadastroRecusaSenhaCurta() throws Exception {
        mvc.perform(post("/auth/cadastro-treinador").contentType(MediaType.APPLICATION_JSON)
                        .content(api.paraJson(Map.of("nomeConsultoria", "Outra", "nome", "Outro",
                                "email", ApiDeTeste.emailUnico("curta"), "senha", "1234567"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DADOS_INVALIDOS"));
    }

    @Test
    void semTokenRecebe401SemDetalhesInternos() throws Exception {
        mvc.perform(get("/eu"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("SESSAO_EXPIRADA"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
        mvc.perform(get("/eu").header(HttpHeaders.AUTHORIZATION, "Bearer nao-e-um-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void corpoAcimaDe1MiBRecebe413() throws Exception {
        byte[] grande = new byte[(int) (1024 * 1024 + 10)];
        java.util.Arrays.fill(grande, (byte) 'a');
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(grande))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.codigo").value("CORPO_EXCEDIDO"));
    }

    private JsonNode loginNativo() throws Exception {
        return api.ler(mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk()).andReturn());
    }

    private JsonNode refreshNativo(String refresh, int esperado) throws Exception {
        return api.ler(mvc.perform(post("/auth/refresh").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(api.paraJson(Map.of("refreshToken", refresh))))
                .andExpect(status().is(esperado)).andReturn());
    }
}
