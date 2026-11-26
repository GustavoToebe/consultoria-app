package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Overtraining Pay desligado (padrão da suíte e da produção): Pix e fatura do aluno respondem 503, sem tocar no Asaas. */
@AutoConfigureMockMvc
class FaturaOvertrainingPayDesligadaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void pixEFaturaRespondem503ComOOvertrainingPayDesligado() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Sem Overtraining Pay"));
        String cobranca = "/aluno/financeiro/cobrancas/" + UUID.randomUUID() + "/overtraining-pay/";

        assertThat(api.post(cobranca + "fatura", aluno, null, 503).path("codigo").asString())
                .isEqualTo("OVERTRAINING_PAY_INDISPONIVEL");
        assertThat(api.post(cobranca + "pix", aluno, null, 503).path("codigo").asString())
                .isEqualTo("OVERTRAINING_PAY_INDISPONIVEL");
    }
}
