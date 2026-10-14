package br.com.treinos.api.web;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Formato do JSON de erro que o app lê (`app/src/api/cliente.ts`): o conjunto exato de campos, o formato do `timestamp`,
 * o `fieldErrors` da validação, `codigo` nulo presente (não omitido) e o `Retry-After` do 429. Escrito contra o código
 * próprio e mantido igual depois da troca pelo módulo web da biblioteca.
 */
@AutoConfigureMockMvc
class ErroJsonIntegrationTest extends AbstractIntegrationTest {

    private static final Set<String> CAMPOS = new TreeSet<>(List.of(
            "timestamp", "status", "error", "message", "codigo", "path", "requestId", "fieldErrors"));

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private JsonNode corpo(MvcResult resultado) throws Exception {
        assertThat(resultado.getResponse().getContentType()).startsWith("application/json");
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new TreeSet<>();
        erro.propertyNames().forEach(nomes::add);
        return nomes;
    }

    private static void confereBase(JsonNode erro, int status, String error, String path) {
        assertThat(campos(erro)).isEqualTo(CAMPOS);
        assertThat(erro.get("status").asInt()).isEqualTo(status);
        assertThat(erro.get("error").asString()).isEqualTo(error);
        assertThat(erro.get("path").asString()).isEqualTo(path);
        assertThat(Instant.parse(erro.get("timestamp").asString())).isNotNull();
        assertThat(erro.get("requestId").asString()).isNotBlank();
        assertThat(erro.get("message").asString()).isNotBlank();
    }

    @Test
    void validacaoDevolveFieldErrorsComFieldEMessage() throws Exception {
        MvcResult r = mvc.perform(post("/auth/cadastro-treinador").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("nomeConsultoria", "", "nome", "", "email", "nao-e-email", "senha", "1"))))
                .andExpect(status().isBadRequest()).andReturn();
        JsonNode erro = corpo(r);
        confereBase(erro, 400, "BAD_REQUEST", "/auth/cadastro-treinador");
        assertThat(erro.get("codigo").asString()).isEqualTo("DADOS_INVALIDOS");
        JsonNode problemas = erro.get("fieldErrors");
        assertThat(problemas.isArray()).isTrue();
        assertThat(problemas.size()).isGreaterThan(0);
        List<String> campos = new ArrayList<>();
        for (JsonNode problema : problemas) {
            assertThat(campos(problema)).isEqualTo(new TreeSet<>(List.of("field", "message")));
            campos.add(problema.get("field").asString());
        }
        assertThat(campos).contains("email");
    }

    @Test
    void rotaInexistenteDevolve404ComCodigoNaoEncontradoESemFieldErrors() throws Exception {
        String raiz = "/rota-que-nao-existe-" + System.nanoTime();
        MvcResult r = mvc.perform(get(raiz)).andReturn();
        // Sem token a cadeia de segurança responde antes do MVC; com token o 404 vem do MVC. Os dois têm o mesmo formato.
        int status = r.getResponse().getStatus();
        JsonNode erro = corpo(r);
        assertThat(campos(erro)).isEqualTo(CAMPOS);
        assertThat(status).isIn(401, 404);
        assertThat(erro.get("fieldErrors").isNull()).isTrue();
        if (status == 401) {
            confereBase(erro, 401, "UNAUTHORIZED", raiz);
            assertThat(erro.get("codigo").asString()).isEqualTo("SESSAO_EXPIRADA");
        }
    }

    @Test
    void erroDeNegocioSemCodigoTrazOCampoCodigoNulo() throws Exception {
        // 405 do MVC: não tem código; o campo continua no JSON, com null, e fieldErrors também.
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        String email = ApiDeTeste.emailUnico("erro");
        api.cadastrarTreinador(email);
        MvcResult login = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                .contentType(MediaType.APPLICATION_JSON).content(api.corpoLogin(email, ApiDeTeste.SENHA)))
                .andExpect(status().isOk()).andReturn();
        String token = json.readTree(login.getResponse().getContentAsString()).get("accessToken").asString();

        MvcResult metodo = mvc.perform(post("/eu").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andReturn();
        JsonNode erro = corpo(metodo);
        confereBase(erro, 405, "METHOD_NOT_ALLOWED", "/eu");
        assertThat(erro.has("codigo")).isTrue();
        assertThat(erro.get("codigo").isNull()).isTrue();
        assertThat(erro.get("fieldErrors").isNull()).isTrue();

        MvcResult inexistente = mvc.perform(get("/rota-que-nao-existe").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andReturn();
        JsonNode naoEncontrado = corpo(inexistente);
        confereBase(naoEncontrado, 404, "NOT_FOUND", "/rota-que-nao-existe");
        assertThat(naoEncontrado.get("codigo").asString()).isEqualTo("NAO_ENCONTRADO");
    }

    @Test
    void loginLimitadoDevolve429ComRetryAfterEOMesmoFormato() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        String email = ApiDeTeste.emailUnico("limite");
        api.cadastrarTreinador(email);
        MvcResult limitado = null;
        for (int i = 0; i < 15 && limitado == null; i++) {
            MvcResult r = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(api.corpoLogin(email, "senha-errada-123"))).andReturn();
            if (r.getResponse().getStatus() == 429) {
                limitado = r;
            }
        }
        assertThat(limitado).as("o limite por conta bloqueia antes de 15 tentativas").isNotNull();
        JsonNode erro = corpo(limitado);
        confereBase(erro, 429, "TOO_MANY_REQUESTS", "/auth/login");
        assertThat(erro.get("codigo").asString()).isEqualTo("LOGIN_LIMITADO");
        assertThat(erro.get("fieldErrors").isNull()).isTrue();
        String retry = limitado.getResponse().getHeader(HttpHeaders.RETRY_AFTER);
        assertThat(retry).isNotNull();
        assertThat(Long.parseLong(retry)).isBetween(1L, 600L);
    }

    @Test
    void corpoExcedidoDevolve413NoMesmoFormato() throws Exception {
        byte[] grande = new byte[1024 * 1024 + 10];
        java.util.Arrays.fill(grande, (byte) 'a');
        MvcResult r = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(grande))
                .andExpect(status().isContentTooLarge()).andReturn();
        JsonNode erro = corpo(r);
        confereBase(erro, 413, "CONTENT_TOO_LARGE", "/auth/login");
        assertThat(erro.get("codigo").asString()).isEqualTo("CORPO_EXCEDIDO");
    }
}
