package br.com.treinos.api.inscricoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A página pública da inscrição traz as redes sociais da consultoria em {@code consultoria.redes} (link https normalizado ou
 * nulo, uma chave por rede) e nunca o contato interno (WhatsApp, e-mail). Só dados fictícios.
 */
@AutoConfigureMockMvc
class RedesNaPaginaDaInscricaoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode admin;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        JsonNode atual = api.get("/inscricoes/configuracao", admin, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        codigo = api.put("/inscricoes/configuracao", admin, corpo, 200).path("codigo").asString();
    }

    private void gravarMarca(Map<String, Object> extra) throws Exception {
        JsonNode atual = api.get("/consultoria", admin, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", atual.path("marca").path("nome").asString());
        corpo.put("corPrimaria", atual.path("marca").path("corPrimaria").asString());
        corpo.put("fonteTitulo", "PADRAO");
        corpo.put("temaPadrao", "CLARO");
        corpo.put("versao", atual.path("versao").asLong());
        corpo.putAll(extra);
        api.put("/consultoria/marca", admin, corpo, 200);
    }

    @Test
    void paginaPublicaTrazAsRedesPreenchidasNulasNasVaziasESemContato() throws Exception {
        // Sem redes: as oito chaves, todas nulas.
        JsonNode vazias = api.get("/publico/inscricoes/" + codigo, null, 200).path("consultoria").path("redes");
        assertThat(vazias.propertyNames()).containsExactlyInAnyOrder("instagram", "tiktok", "youtube", "x", "site", "facebook",
                "linkedin", "telegram");
        vazias.forEach(v -> assertThat(v.isNull()).isTrue());

        Map<String, Object> redes = new LinkedHashMap<>();
        redes.put("instagram", "@consultoria.ficticia");
        redes.put("site", "https://www.exemplo-ficticio.com.br");
        gravarMarca(Map.of("redesSociais", redes, "whatsapp", "(45) 99999-8888", "emailResponderPara", "contato-interno@teste.local",
                "emailRemetenteNome", "Time Fictício"));

        JsonNode pagina = api.get("/publico/inscricoes/" + codigo, null, 200);
        JsonNode publicas = pagina.path("consultoria").path("redes");
        assertThat(publicas.path("instagram").asString()).startsWith("https://").contains("consultoria.ficticia");
        assertThat(publicas.path("site").asString()).startsWith("https://www.exemplo-ficticio.com.br");
        for (String vazia : new String[] {"tiktok", "youtube", "x", "facebook", "linkedin", "telegram"}) {
            assertThat(publicas.path(vazia).isNull()).as(vazia).isTrue();
        }
        // Contato interno nunca vai à página pública.
        assertThat(pagina.path("consultoria").propertyNames()).doesNotContain("whatsapp", "email", "telefone", "emailResponderPara",
                "emailRemetenteNome");
        assertThat(pagina.toString()).doesNotContain("99999-8888", "contato-interno@teste.local", "Time Fictício");
    }
}
