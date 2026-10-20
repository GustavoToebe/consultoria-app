package br.com.treinos.api.equipe;

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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Consulta pública do convite de equipe (marca da consultoria antes do aceite): código só no corpo, e código inexistente,
 * vencido, já aceito ou fora do formato dão a mesma resposta 404.
 */
@AutoConfigureMockMvc
class ConsultaConviteEquipeIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach void preparar() throws Exception { api = new ApiDeTeste(mvc, json); admin = api.novoTreinador(); }

    private String perfilAssistente() throws Exception {
        for (var p : api.get("/perfis", admin, 200)) if (p.path("nome").asString().equals("Assistente")) return p.path("id").asString();
        throw new AssertionError("Perfil pronto ausente");
    }

    private String novoConvite() throws Exception {
        return novoConvite(ApiDeTeste.emailUnico("consulta"));
    }

    private String novoConvite(String email) throws Exception {
        return api.post("/usuarios/convites", admin, Map.of("nome", "Convidada fictícia", "email", email,
                "perfilId", perfilAssistente()), 200).path("codigo").asString();
    }

    private JsonNode consultar(String codigo, int esperado) throws Exception {
        return api.post("/publico/convites-equipe/consultar", null, Map.of("codigo", codigo), esperado);
    }

    @Test void conviteValidoMostraSoAMarcaDaConsultoria() throws Exception {
        var resposta = consultar(novoConvite(), 200);
        assertThat(resposta.propertyNames()).containsExactly("consultoria");
        var marca = resposta.path("consultoria");
        assertThat(marca.path("nome").asString()).isNotBlank();
        assertThat(marca.path("corPrimaria").asString()).matches("#[0-9A-Fa-f]{6}");
    }

    @Test void consultarNaoConsomeOConvite() throws Exception {
        String codigo = novoConvite();
        consultar(codigo, 200);
        consultar(codigo, 200);
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigo, "senha", ApiDeTeste.SENHA), 200);
    }

    @Test void inexistenteVencidoAceitoEForaDoFormatoDaoOMesmo404() throws Exception {
        String emailVencido = ApiDeTeste.emailUnico("vencido");
        String vencido = novoConvite(emailVencido);
        banco.update("update usuario_convite set expira_em = now() - interval '1 day' where email = ?", emailVencido);
        String aceito = novoConvite();
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", aceito, "senha", ApiDeTeste.SENHA), 200);

        var inexistente = consultar("a".repeat(43), 404);
        var respostas = new JsonNode[] { consultar(vencido, 404), consultar(aceito, 404), consultar("curto", 404), consultar("a".repeat(64), 404) };
        for (var r : respostas) {
            assertThat(r.path("codigo").asString()).isEqualTo(inexistente.path("codigo").asString());
            assertThat(r.path("message").asString()).isEqualTo(inexistente.path("message").asString());
            assertThat(r.path("status").asInt()).isEqualTo(404);
        }
    }

    @Test void aceiteComCodigoInvalidoDaOMesmo404DaConsultaEValidaOCorpo() throws Exception {
        var consulta = consultar("a".repeat(43), 404);
        for (String codigo : new String[] { "a".repeat(43), "curto", "a".repeat(64) }) {
            var aceite = api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigo, "senha", ApiDeTeste.SENHA), 404);
            assertThat(aceite.path("codigo").asString()).isEqualTo(consulta.path("codigo").asString());
            assertThat(aceite.path("message").asString()).isEqualTo(consulta.path("message").asString());
        }
        // Código em branco ou grande demais é recusado na validação do corpo, sem chegar ao convite.
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", " ", "senha", ApiDeTeste.SENHA), 400);
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", "a".repeat(65), "senha", ApiDeTeste.SENHA), 400);
        api.post("/publico/convites-equipe/aceitar", null, Map.of("senha", ApiDeTeste.SENHA), 400);
    }

    @Test void rotaAntigaComOCodigoNoCaminhoNaoExisteMaisENaoAceitaOConvite() throws Exception {
        String codigo = novoConvite();
        // Sem rota com o código no caminho: o Spring responde 404 (nenhum handler casa) e nada é aceito.
        api.post("/publico/convites-equipe/" + codigo, null, Map.of("senha", ApiDeTeste.SENHA), 404);
        api.post("/publico/convites-equipe/" + codigo, null, Map.of("codigo", codigo, "senha", ApiDeTeste.SENHA), 404);
        // O convite continua válido e só o aceite novo o consome.
        consultar(codigo, 200);
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigo, "senha", ApiDeTeste.SENHA), 200);
    }
}
