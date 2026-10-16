package br.com.treinos.api.consultoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A rota pública da logo tem teto por IP (aqui baixado para 3 por janela; na suíte o teto é alto). */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.limites.logo-ip=3")
class LogoPublicaLimiteIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void passadoOTetoDoIpResponde429ComRetryAfter() throws Exception {
        JsonNode treinador = new ApiDeTeste(mvc, json).novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.get("usuario").get("id").asString());
        // Consultoria sem logo: 404 enquanto há folga; a quarta chamada do mesmo IP já é barrada antes de qualquer leitura.
        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/publico/marcas/" + consultoria + "/logo").with(r -> {
                r.setRemoteAddr("203.0.113.7");
                return r;
            })).andExpect(status().isNotFound());
        }
        mvc.perform(get("/publico/marcas/" + consultoria + "/logo").with(r -> {
            r.setRemoteAddr("203.0.113.7");
            return r;
        })).andExpect(status().isTooManyRequests()).andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.codigo").exists());
        // Outro IP não paga pelo primeiro.
        mvc.perform(get("/publico/marcas/" + consultoria + "/logo").with(r -> {
            r.setRemoteAddr("203.0.113.8");
            return r;
        })).andExpect(status().isNotFound());
    }
}
