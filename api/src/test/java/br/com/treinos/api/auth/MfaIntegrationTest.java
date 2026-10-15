package br.com.treinos.api.auth;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verificação em duas etapas do treinador: preparar, ativar, entrar com o código ou com um código de recuperação, desativar.
 * Cada código TOTP só vale uma vez e a janela é de um passo para cada lado; por isso ativar usa o passo atual, entrar usa o
 * seguinte e desativar usa um código de recuperação (resiste a uma virada de passo no meio do teste).
 */
@AutoConfigureMockMvc
class MfaIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private String email;
    private JsonNode treinador;

    @BeforeEach
    void criarTreinador() throws Exception {
        api = new ApiDeTeste(mvc, json);
        email = ApiDeTeste.emailUnico("mfa");
        treinador = api.cadastrarTreinador(email);
    }

    @Test
    void ativarExigeSenhaECodigoEDerrubaOTokenAntigo() throws Exception {
        assertThat(api.get("/eu/mfa", treinador, 200).get("ativo").asBoolean()).isFalse();

        JsonNode senhaErrada = api.post("/eu/mfa/preparar", treinador, Map.of("senha", "senha-errada-123"), 400);
        assertThat(senhaErrada.get("codigo").asString()).isEqualTo("MFA_SENHA_INVALIDA");

        JsonNode preparacao = api.post("/eu/mfa/preparar", treinador, Map.of("senha", ApiDeTeste.SENHA), 200);
        String segredo = preparacao.get("segredo").asString();
        assertThat(preparacao.get("otpauthUri").asString())
                .startsWith("otpauth://totp/Treinos:").contains("secret=" + segredo).contains("issuer=Treinos");

        long passo = Instant.now().getEpochSecond() / 30;
        JsonNode codigoErrado = api.post("/eu/mfa/ativar", treinador,
                Map.of("senha", ApiDeTeste.SENHA, "codigo", "000000"), 401);
        assertThat(codigoErrado.get("codigo").asString()).isEqualTo("MFA_CODIGO_INVALIDO");

        JsonNode ativacao = api.post("/eu/mfa/ativar", treinador,
                Map.of("senha", ApiDeTeste.SENHA, "codigo", codigo(segredo, passo)), 200);
        assertThat(ativacao.get("codigosDeRecuperacao")).isNotEmpty();
        JsonNode sessaoNova = ativacao.get("sessao");
        assertThat(sessaoNova.get("accessToken").asString()).isNotBlank();
        assertThat(sessaoNova.get("refreshToken").asString()).isNotBlank();

        // A versão das credenciais subiu: o token de antes da ativação deixou de valer, o novo vale.
        api.get("/eu", treinador, 401);
        api.get("/eu", sessaoNova, 200);
        JsonNode status = api.get("/eu/mfa", sessaoNova, 200);
        assertThat(status.get("ativo").asBoolean()).isTrue();
        assertThat(status.get("codigosRestantes").asInt()).isEqualTo(ativacao.get("codigosDeRecuperacao").size());
        assertThat(api.get("/auditoria?acao=MFA_ATIVADO", sessaoNova, 200).path("itens")).hasSize(1);
    }

    @Test
    void entrarPedeOCodigoEAceitaUmaVezCadaCodigo() throws Exception {
        long passo = Instant.now().getEpochSecond() / 30;
        JsonNode ativacao = ativar(passo);
        String segredo = ativacao.get("segredo").asString();
        String recuperacao = ativacao.get("recuperacao").asString();

        login(email, null, 401, "MFA_NECESSARIO");
        login(email, "000000", 401, "MFA_CODIGO_INVALIDO");
        JsonNode comCodigo = login(email, codigo(segredo, passo + 1), 200, null);
        assertThat(comCodigo.get("accessToken").asString()).isNotBlank();
        // O mesmo código não vale duas vezes.
        login(email, codigo(segredo, passo + 1), 401, "MFA_CODIGO_INVALIDO");

        login(email, recuperacao, 200, null);
        login(email, recuperacao, 401, "MFA_CODIGO_INVALIDO");
    }

    @Test
    void desativarVoltaAEntrarSoComASenha() throws Exception {
        long passo = Instant.now().getEpochSecond() / 30;
        JsonNode ativacao = ativar(passo);
        String segredo = ativacao.get("segredo").asString();
        String recuperacao = ativacao.get("recuperacao").asString();
        JsonNode sessao = ativacao.get("sessao");
        login(email, codigo(segredo, passo + 1), 200, null);

        JsonNode erro = api.post("/eu/mfa/desativar", sessao,
                Map.of("senha", ApiDeTeste.SENHA, "codigo", "000000"), 401);
        assertThat(erro.get("codigo").asString()).isEqualTo("MFA_CODIGO_INVALIDO");

        JsonNode depois = api.post("/eu/mfa/desativar", sessao,
                Map.of("senha", ApiDeTeste.SENHA, "codigo", recuperacao), 200);
        assertThat(depois.get("accessToken").asString()).isNotBlank();
        api.get("/eu", sessao, 401);
        assertThat(api.get("/eu/mfa", depois, 200).get("ativo").asBoolean()).isFalse();
        login(email, null, 200, null);
        assertThat(api.get("/auditoria?acao=MFA_DESATIVADO", depois, 200).path("itens")).hasSize(1);
    }

    @Test
    void tentativasPassamPeloLimiteDoLogin() throws Exception {
        for (int i = 0; i < 10; i++) {
            api.post("/eu/mfa/preparar", treinador, Map.of("senha", "senha-errada-123"), 400);
        }
        MvcResult bloqueada = mvc.perform(post("/eu/mfa/preparar").header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("senha", ApiDeTeste.SENHA))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.codigo").value("LOGIN_LIMITADO"))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andReturn();
        assertThat(bloqueada.getResponse().getContentAsString()).doesNotContain("segredo");
    }

    @Test
    void alunoNaoUsaARotaDeMfa() throws Exception {
        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Teste"));
        api.get("/eu/mfa", aluno, 403);
        api.post("/eu/mfa/preparar", aluno, Map.of("senha", ApiDeTeste.SENHA), 403);
    }

    @Test
    void semTokenARotaDeMfaRecusa() throws Exception {
        mvc.perform(get("/eu/mfa")).andExpect(status().isUnauthorized());
    }

    /** Prepara e ativa com o código do passo dado; devolve segredo, sessão nova e um código de recuperação. */
    private JsonNode ativar(long passoDoCodigo) throws Exception {
        String segredo = api.post("/eu/mfa/preparar", treinador, Map.of("senha", ApiDeTeste.SENHA), 200)
                .get("segredo").asString();
        JsonNode ativacao = api.post("/eu/mfa/ativar", treinador,
                Map.of("senha", ApiDeTeste.SENHA, "codigo", codigo(segredo, passoDoCodigo)), 200);
        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("segredo", segredo);
        resultado.put("recuperacao", ativacao.get("codigosDeRecuperacao").get(0).asString());
        resultado.put("sessao", ativacao.get("sessao"));
        return json.valueToTree(resultado);
    }

    private JsonNode login(String conta, String codigoMfa, int esperado, String codigoDoErro) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("email", conta);
        corpo.put("senha", ApiDeTeste.SENHA);
        if (codigoMfa != null) {
            corpo.put("codigoMfa", codigoMfa);
        }
        MvcResult r = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                .andExpect(status().is(esperado)).andReturn();
        JsonNode resposta = api.ler(r);
        if (codigoDoErro != null) {
            assertThat(resposta.get("codigo").asString()).isEqualTo(codigoDoErro);
        }
        return resposta;
    }

    /** O código de 6 dígitos que o aplicativo autenticador mostraria no passo dado (RFC 6238, SHA-1, 30 s). */
    static String codigo(String segredo, long passo) {
        try {
            byte[] chave = new byte[segredo.length() * 5 / 8];
            int bits = 0;
            int buffer = 0;
            int posicao = 0;
            for (int i = 0; i < segredo.length(); i++) {
                buffer = (buffer << 5) | BASE32.indexOf(segredo.charAt(i));
                bits += 5;
                if (bits >= 8) {
                    bits -= 8;
                    chave[posicao++] = (byte) (buffer >>> bits);
                }
            }
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(chave, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(passo).array());
            int deslocamento = hash[hash.length - 1] & 15;
            int numero = ByteBuffer.wrap(hash, deslocamento, 4).getInt() & 0x7fffffff;
            return String.format(Locale.ROOT, "%06d", numero % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
