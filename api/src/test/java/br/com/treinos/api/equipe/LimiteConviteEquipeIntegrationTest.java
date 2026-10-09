package br.com.treinos.api.equipe;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@AutoConfigureMockMvc @SpringBootTest(properties="treinos.limites.convite-ip=2")
class LimiteConviteEquipeIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Test void rotaPublicaLimitaTentativasAntesDoAceite() throws Exception {
        for(int i=0;i<3;i++) {
            mvc.perform(post("/publico/convites-equipe/incorreto").with(req -> {req.setRemoteAddr("198.51.100.70");return req;})
                            .header("X-Treinos-Cliente","nativo").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"senha\":\""+ApiDeTeste.SENHA+"\"}"))
                    .andExpect(status().is(i<2?404:429));
        }
    }
}
