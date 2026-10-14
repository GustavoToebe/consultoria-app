package br.com.treinos.api.monitoramento;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sem {@code MONITORAMENTO_TOKEN} (o padrão do app) a coleta fica fechada, qualquer que seja o cabeçalho. */
@AutoConfigureMockMvc
class MetricasFechadasIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void semTokenConfiguradoAColetaRespondeSempre401() throws Exception {
        mvc.perform(get("/monitoramento/metrics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/monitoramento/metrics").header("Authorization", "Monitoring ")).andExpect(status().isUnauthorized());
        mvc.perform(get("/monitoramento/metrics").header("Authorization", "Monitoring " + "a".repeat(40)))
                .andExpect(status().isUnauthorized());
    }
}
