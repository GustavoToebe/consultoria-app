package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Nome de aba acentuado na planilha completa: o nome chega ao app como está no arquivo (análise e histórico da
 * importação). Um nome com "?" (o Excel não aceita "?" em aba: é arquivo gravado com a codificação errada) também chega
 * como veio, sem ser tratado como acento. Planilhas fictícias montadas no teste.
 */
@AutoConfigureMockMvc
class NomesDeAbaIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE = "/importacoes/planilha-completa/";
    private static final String CORRETO = "Refeições";
    private static final String COM_INTERROGACAO = "Refei????es";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    /** A planilha fictícia do treinador com a aba de refeições (e a de pesos) sob outro nome. */
    private static byte[] planilhaComAba(String nomeDasRefeicoes) {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        PlanilhaDeTeste.abasDoTreinador().forEach((nome, linhas) -> abas.put(nome.equals(CORRETO) ? nomeDasRefeicoes : nome, linhas));
        return PlanilhaDeTeste.xlsx(abas);
    }

    private JsonNode enviar(String acao, byte[] planilha, String hash) throws Exception {
        var pedido = multipart(BASE + acao)
                .file(new MockMultipartFile("arquivo", "planilha.xlsx", "application/octet-stream", planilha));
        if (hash != null) {
            pedido.param("hash", hash);
        }
        pedido.header("X-Treinos-Cliente", "nativo");
        pedido.header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador));
        String texto = mvc.perform(pedido).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(texto);
    }

    /**
     * O nome da aba de refeições em cada lugar em que a tela o lê: a análise (aba e problema por aba) e o histórico da
     * importação (erros guardados, "aba: problema"). A aba é reconhecida pelos títulos, não pelo nome.
     */
    private void confereNomeDaAba(String nome) throws Exception {
        byte[] planilha = planilhaComAba(nome);
        JsonNode analise = enviar("analisar", planilha, null);
        JsonNode previa = enviar("previa", planilha, null);
        JsonNode feito = enviar("confirmar", planilha, previa.path("hash").asString());
        JsonNode detalhe = api.get("/importacoes/" + feito.path("importacaoId").asString(), treinador, 200);

        List<String> abas = new ArrayList<>();
        analise.path("abas").forEach(a -> abas.add(a.path("nome").asString() + " = " + a.path("tipo").asString()));
        assertThat(abas).contains(nome + " = DIETA");
        List<String> problemas = new ArrayList<>();
        analise.path("problemas").forEach(p -> problemas.add(p.path("aba").asString() + ": " + p.path("tipo").asString()));
        assertThat(problemas).contains(nome + ": ITEM_SEM_ALIMENTO");
        List<String> erros = new ArrayList<>();
        detalhe.path("erros").forEach(e -> erros.add(e.path("motivo").asString()));
        assertThat(erros).contains(nome + ": ITEM_SEM_ALIMENTO");
    }

    @Test
    void nomeDeAbaAcentuadoChegaCertoAoApp() throws Exception {
        confereNomeDaAba(CORRETO);
    }

    @Test
    void nomeDeAbaComInterrogacaoChegaComoVeioEAAbaContinuaLida() throws Exception {
        confereNomeDaAba(COM_INTERROGACAO);
    }
}
