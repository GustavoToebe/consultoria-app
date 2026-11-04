package br.com.treinos.api.migracao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Modo padrão de produção: a migração assistida fica no código, desligada ({@code TREINOS_MIGRACAO_ASSISTIDA_HABILITADA=false}).
 * A rota do diagnóstico responde 503 {@code MIGRACAO_INDISPONIVEL}, o {@code GET /eu} diz ao app para esconder tudo e a
 * importação que já existe não é afetada. A suíte liga a chave; só esta classe a desliga.
 */
@AutoConfigureMockMvc
class MigracaoAssistidaDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registry) {
        registry.add("treinos.migracao-assistida.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void diagnosticoRespondeIndisponivelEEuDizQueEstaDesligado() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();

        String texto = mvc.perform(multipart("/importacoes/diagnostico")
                        .file(new MockMultipartFile("arquivo", "a.csv", "text/csv", "Nome;Email\nAluno Teste 1;a@example.com\n".getBytes(StandardCharsets.UTF_8)))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andExpect(status().isServiceUnavailable()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(json.readTree(texto).path("codigo").asString()).isEqualTo("MIGRACAO_INDISPONIVEL");

        // A amostra revisável (fase 2) segue a mesma chave; a prévia, a confirmação e o desfazer da planilha completa não.
        String amostra = mvc.perform(multipart("/importacoes/planilha-completa/amostra")
                        .file(new MockMultipartFile("arquivo", "a.csv", "text/csv", "Nome;Email\nAluno Teste 1;a@example.com\n".getBytes(StandardCharsets.UTF_8)))
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andExpect(status().isServiceUnavailable()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(json.readTree(amostra).path("codigo").asString()).isEqualTo("MIGRACAO_INDISPONIVEL");

        assertThat(api.get("/eu", treinador, 200).path("migracaoAssistidaHabilitada").asBoolean()).isFalse();
        // A importação que já existia segue respondendo.
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }
}
