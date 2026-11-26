package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;

/**
 * Troca do e-mail de acesso com o envio de e-mails desligado (sem {@code EnviadorDeEmail}: {@code preparar} devolve nulo, como
 * {@link AvisoDeTrocaDeEmailDeAcessoTest} confere): a troca vale e a resposta traz {@code emailEnviado = false}. O contexto
 * de teste sempre tem o provedor, então o desligado é simulado no aviso. Só dados fictícios.
 */
@AutoConfigureMockMvc
class EmailDeAcessoDesligadoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @MockitoSpyBean private AvisoDeTrocaDeEmailDeAcesso aviso;

    @Test
    void semEnvioLigadoATrocaValeEEmailEnviadoEFalse() throws Exception {
        doReturn(null).when(aviso).preparar(any(), any(), any());
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício");
        api.convidarEEntrar(treinador, alunoId);
        String novo = ApiDeTeste.emailUnico("desligado");

        JsonNode resposta = api.put("/alunos/" + alunoId + "/acesso/email", treinador, Map.of("email", novo), 200);

        assertThat(resposta.path("emailEnviado").asBoolean(true)).isFalse();
        assertThat(resposta.path("aluno").path("emailDeAcesso").asString()).isEqualTo(novo);
        assertThat(EmailDeTeste.para(novo)).as("nada saiu para o endereço novo").isEmpty();
    }
}
