package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Padrão de produção do marketplace: vitrine e loja ligadas, {@code TREINOS_MARKETPLACE_HABILITADO=false}. A lista pública dá 503
 * {@code MARKETPLACE_INDISPONIVEL} (com ou sem parâmetros) e o {@code GET /eu} diz ao app que está desligado; a vitrine, a loja e o
 * opt-in gravado pela equipe seguem funcionando (o app é quem esconde o interruptor).
 */
@AutoConfigureMockMvc
class MarketplaceDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarOMarketplace(DynamicPropertyRegistry registry) {
        registry.add("treinos.vitrine.marketplace-habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void listaDa503ELojaEVitrineSeguemFuncionando() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Marketplace Desligado");
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        for (String caminho : new String[] {"/publico/lojas", "/publico/lojas?pagina=0&tamanho=10", "/publico/lojas?pagina=999999999"}) {
            assertThat(api.get(caminho, null, 503).path("codigo").asString()).isEqualTo("MARKETPLACE_INDISPONIVEL");
        }
        mvc.perform(get("/publico/lojas")).andExpect(status().isServiceUnavailable())
                .andExpect(result -> assertThat(String.valueOf(result.getResponse().getHeader("Cache-Control"))).doesNotContain("public"));
        for (JsonNode eu : new JsonNode[] {api.get("/eu", treinador, 200), api.get("/eu", login, 200)}) {
            assertThat(eu.get("vitrineHabilitada").asBoolean()).isTrue();
            assertThat(eu.get("lojaHabilitada").asBoolean()).isTrue();
            assertThat(eu.get("marketplaceHabilitado").asBoolean()).isFalse();
        }

        // A loja e o opt-in da equipe continuam: o dado fica gravado para quando a chave ligar.
        JsonNode config = api.put("/vitrine/configuracao", treinador, Map.of("paginaLigada", true, "noMarketplace", true), 200);
        assertThat(config.get("noMarketplace").asBoolean()).isTrue();
        api.get("/publico/loja/" + config.get("codigo").asString(), null, 200);
        JsonNode item = api.post("/vitrine/itens", treinador,
                Map.of("nome", "Planilha Fictícia", "tipo", "DIGITAL", "ativo", true, "naPaginaPublica", true, "noMarketplace", true), 200);
        assertThat(item.get("noMarketplace").asBoolean()).isTrue();
    }
}
