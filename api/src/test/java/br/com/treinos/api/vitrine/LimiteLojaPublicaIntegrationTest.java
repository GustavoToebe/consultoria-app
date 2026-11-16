package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A página pública da loja e as fotos têm um teto por IP cada um, em baldes separados (aqui 2 por janela; na suíte o teto é alto). */
@AutoConfigureMockMvc
@SpringBootTest(properties = {"treinos.limites.loja-ip=2", "treinos.limites.loja-foto-ip=2"})
class LimiteLojaPublicaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;

    private static RequestPostProcessor ip(String ip) {
        return req -> {
            req.setRemoteAddr(ip);
            return req;
        };
    }

    @Test
    void paginaEFotoLimitamPorIpEmBaldesSeparadosComRetryAfter() throws Exception {
        String codigo = "c".repeat(24);
        String foto = "/publico/loja/" + codigo + "/itens/" + UUID.randomUUID() + "/foto";
        String pagina = "/publico/loja/" + codigo;
        RequestPostProcessor a = ip("198.51.100.91");

        mvc.perform(get(pagina).with(a)).andExpect(status().isNotFound());
        mvc.perform(get(pagina).with(a)).andExpect(status().isNotFound());
        mvc.perform(get(pagina).with(a)).andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));

        // Com o balde da página esgotado, as fotos do mesmo IP ainda passam (o delas é outro) e têm o próprio teto.
        mvc.perform(get(foto).with(a)).andExpect(status().isNotFound());
        mvc.perform(get(foto).with(a)).andExpect(status().isNotFound());
        mvc.perform(get(foto).with(a)).andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));

        // Outro IP não é afetado, nem na página nem na foto.
        mvc.perform(get(pagina).with(ip("198.51.100.92"))).andExpect(status().isNotFound());
        mvc.perform(get(foto).with(ip("198.51.100.92"))).andExpect(status().isNotFound());
    }
}
