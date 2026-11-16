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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção: a vitrine fica no código, desligada ({@code TREINOS_VITRINE_HABILITADA=false}). Toda rota dela
 * (equipe e aluno, leitura inclusive) responde 503 {@code VITRINE_INDISPONIVEL} e o {@code GET /eu} diz ao app para esconder
 * tudo. A suíte liga a chave; só esta classe a desliga.
 */
@AutoConfigureMockMvc
class VitrineDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarAVitrine(DynamicPropertyRegistry registry) {
        registry.add("treinos.vitrine.habilitada", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void rotasDaVitrineRespondem503EEuDizQueEstaDesligada() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Vitrine Desligada");
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        UUID qualquer = UUID.randomUUID();

        Map<String, Object> item = Map.of("nome", "Item fictício", "tipo", "FISICO", "ativo", true);
        assertThat(api.get("/vitrine/itens", treinador, 503).path("codigo").asString()).isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.post("/vitrine/itens", treinador, item, 503).path("codigo").asString()).isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.put("/vitrine/itens/" + qualquer, treinador, item, 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.delete("/vitrine/itens/" + qualquer + "?versao=0", treinador, 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.put("/vitrine/itens/ordem", treinador, Map.of("ids", List.of(qualquer)), 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.get("/vitrine/itens/" + qualquer + "/foto", treinador, 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.delete("/vitrine/itens/" + qualquer + "/foto", treinador, 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.get("/aluno/vitrine", login, 503).path("codigo").asString()).isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.get("/aluno/vitrine/itens/" + qualquer + "/foto", login, 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");

        assertThat(api.get("/vitrine/configuracao", treinador, 503).path("codigo").asString()).isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.put("/vitrine/configuracao", treinador, Map.of("paginaLigada", true), 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");
        assertThat(api.post("/vitrine/configuracao/novo-link", treinador, Map.of(), 503).path("codigo").asString())
                .isEqualTo("VITRINE_INDISPONIVEL");

        assertThat(api.get("/eu", login, 200).get("vitrineHabilitada").asBoolean()).isFalse();
        assertThat(api.get("/eu", treinador, 200).get("vitrineHabilitada").asBoolean()).isFalse();

        // A loja só vale com a vitrine ligada, mesmo com a chave dela ligada (a suíte liga as duas): 503 próprio, nunca 404.
        assertThat(api.get("/publico/loja/" + "Z".repeat(24), null, 503).path("codigo").asString()).isEqualTo("LOJA_INDISPONIVEL");
        assertThat(api.get("/eu", treinador, 200).get("lojaHabilitada").asBoolean()).isFalse();
        // O marketplace também: depende da loja, que depende da vitrine.
        assertThat(api.get("/publico/lojas", null, 503).path("codigo").asString()).isEqualTo("MARKETPLACE_INDISPONIVEL");
        assertThat(api.get("/eu", treinador, 200).get("marketplaceHabilitado").asBoolean()).isFalse();
    }
}
