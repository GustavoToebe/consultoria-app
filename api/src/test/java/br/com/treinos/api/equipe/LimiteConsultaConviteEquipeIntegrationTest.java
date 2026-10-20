package br.com.treinos.api.equipe;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A consulta pública do convite de equipe tem teto próprio por IP (aqui 2 por janela; na suíte o teto é alto). */
@AutoConfigureMockMvc
@SpringBootTest(properties = "treinos.limites.convite-equipe-consulta-ip=2")
class LimiteConsultaConviteEquipeIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;

    @Test void consultaLimitaTentativasPorIpComRetryAfter() throws Exception {
        for (int i = 0; i < 3; i++) {
            var resultado = mvc.perform(post("/publico/convites-equipe/consultar").with(req -> { req.setRemoteAddr("198.51.100.81"); return req; })
                    .contentType(MediaType.APPLICATION_JSON).content("{\"codigo\":\"" + "b".repeat(43) + "\"}"))
                    .andExpect(status().is(i < 2 ? 404 : 429));
            if (i == 2) resultado.andExpect(header().exists("Retry-After"));
        }
    }
}
