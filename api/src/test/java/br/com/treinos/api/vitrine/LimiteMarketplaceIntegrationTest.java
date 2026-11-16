package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A lista pública de lojas tem teto por IP e janela, em balde próprio (aqui 2; na suíte o teto é alto). */
@AutoConfigureMockMvc
@SpringBootTest(properties = {"treinos.limites.marketplace-ip=2", "treinos.limites.loja-ip=100000"})
class LimiteMarketplaceIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;

    private static RequestPostProcessor ip(String ip) {
        return req -> {
            req.setRemoteAddr(ip);
            return req;
        };
    }

    @Test
    void listaLimitaPorIpComRetryAfterEOutroIpNaoEAfetado() throws Exception {
        RequestPostProcessor a = ip("198.51.100.171");
        mvc.perform(get("/publico/lojas").with(a)).andExpect(status().isOk());
        mvc.perform(get("/publico/lojas?pagina=1&tamanho=5").with(a)).andExpect(status().isOk());
        mvc.perform(get("/publico/lojas").with(a)).andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"))
                .andExpect(result -> assertThat(String.valueOf(result.getResponse().getHeader("Cache-Control"))).doesNotContain("public"));

        // O balde da página da loja é outro: o mesmo IP ainda passa nele (404, código que não existe).
        mvc.perform(get("/publico/loja/" + "c".repeat(24)).with(a)).andExpect(status().isNotFound());
        mvc.perform(get("/publico/lojas").with(ip("198.51.100.172"))).andExpect(status().isOk());
    }
}
