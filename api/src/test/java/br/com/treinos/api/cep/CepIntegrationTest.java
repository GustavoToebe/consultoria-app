package br.com.treinos.api.cep;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A rota da busca de CEP: quem entra e o CEP fora do formato (que responde antes de qualquer chamada ao serviço de CEP:
 * a consulta de verdade é do {@link CepServiceTest}, contra um serviço de mentira, sem rede).
 */
@AutoConfigureMockMvc
class CepIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/enderecos/cep/consultar";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void semLoginEhNegado() throws Exception {
        api.post(ROTA, null, Map.of("cep", "85807677"), 401);
    }

    @Test
    void cepForaDoFormatoEh400ParaTreinadorEAluno() throws Exception {
        JsonNode erro = api.post(ROTA, treinador, Map.of("cep", "123"), 400);
        assertThat(erro.get("codigo").asString()).isEqualTo("CEP_INVALIDO");

        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        assertThat(api.post(ROTA, aluno, Map.of("cep", "abcdefgh"), 400).get("codigo").asString()).isEqualTo("CEP_INVALIDO");
    }

    @Test
    void corpoSemCepOuGrandeDemaisEhRecusado() throws Exception {
        assertThat(api.post(ROTA, treinador, Map.of(), 400).get("codigo").asString()).isEqualTo("CEP_INVALIDO");
        assertThat(api.post(ROTA, treinador, Map.of("cep", "1".repeat(50)), 400).get("codigo").asString()).isEqualTo("DADOS_INVALIDOS");
    }
}
