package br.com.treinos.api.vitrine;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Padrão de produção da loja: a vitrine ligada e a página pública desligada ({@code TREINOS_LOJA_HABILITADA=false}). A página
 * pública, a foto e as três rotas de configuração dão 503 {@code LOJA_INDISPONIVEL}; a vitrine e o campo
 * {@code naPaginaPublica} do item seguem funcionando e o {@code GET /eu} diz ao app que a loja está desligada.
 */
@AutoConfigureMockMvc
class LojaDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarALoja(DynamicPropertyRegistry registry) {
        registry.add("treinos.vitrine.loja-habilitada", () -> "false");
        registry.add("treinos.vitrine.marketplace-habilitado", () -> "true");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void rotasDaLojaRespondem503ComAVitrineFuncionandoEEuDizQueEstaDesligada() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Loja Desligada");
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?", UUID.class, aluno);
        // Página ligada no banco: mesmo assim a chave da plataforma manda, com o código real ou com qualquer outro.
        String codigo = "L" + UUID.randomUUID().toString().replace("-", "");
        jdbc.update("insert into vitrine_configuracao (id, consultoria_id, codigo_publico, pagina_ligada) values (?, ?, ?, true)",
                UUID.randomUUID(), consultoria, codigo);

        for (String c : new String[] {codigo, "Z".repeat(24), "curto"}) {
            assertThat(api.get("/publico/loja/" + c, null, 503).path("codigo").asString()).isEqualTo("LOJA_INDISPONIVEL");
            assertThat(api.get("/publico/loja/" + c + "/itens/" + UUID.randomUUID() + "/foto", null, 503).path("codigo").asString())
                    .isEqualTo("LOJA_INDISPONIVEL");
        }
        assertThat(api.get("/vitrine/configuracao", treinador, 503).path("codigo").asString()).isEqualTo("LOJA_INDISPONIVEL");
        assertThat(api.put("/vitrine/configuracao", treinador, Map.of("paginaLigada", true), 503).path("codigo").asString())
                .isEqualTo("LOJA_INDISPONIVEL");
        assertThat(api.post("/vitrine/configuracao/novo-link", treinador, Map.of(), 503).path("codigo").asString())
                .isEqualTo("LOJA_INDISPONIVEL");

        assertThat(api.get("/publico/lojas", null, 503).path("codigo").asString()).isEqualTo("MARKETPLACE_INDISPONIVEL");

        // A vitrine continua: o item aceita naPaginaPublica (o app é quem esconde o interruptor) e o aluno lê a lista.
        JsonNode item = api.post("/vitrine/itens", treinador,
                Map.of("nome", "Planilha Fictícia", "tipo", "DIGITAL", "ativo", true, "naPaginaPublica", true), 200);
        assertThat(item.get("naPaginaPublica").asBoolean()).isTrue();
        api.get("/vitrine/itens", treinador, 200);
        api.get("/aluno/vitrine", login, 200);

        for (JsonNode eu : new JsonNode[] {api.get("/eu", treinador, 200), api.get("/eu", login, 200)}) {
            assertThat(eu.get("vitrineHabilitada").asBoolean()).isTrue();
            assertThat(eu.get("lojaHabilitada").asBoolean()).isFalse();
            // O marketplace depende da loja: com a chave dele ligada (suíte) e a loja desligada, o app o recebe desligado.
            assertThat(eu.get("marketplaceHabilitado").asBoolean()).isFalse();
        }
    }
}
