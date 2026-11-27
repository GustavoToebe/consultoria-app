package br.com.treinos.api.receitas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import db.migration.V115__origem_da_receita;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Origem da receita (V115, aba "Minhas" da folha "Usar receita"): o servidor decide (padrão = do sistema, consultoria = da
 * equipe), o cliente não força, e a receita de uma consultoria nunca aparece para outra.
 */
@AutoConfigureMockMvc
class OrigemDaReceitaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private static boolean contem(JsonNode lista, String id) {
        for (JsonNode r : lista) if (r.get("id").asString().equals(id)) return true;
        return false;
    }

    @Test
    void consultoriaNovaSoTemPadraoEAListaDaV115CobreTodas() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class,
                UUID.fromString(treinador.path("usuario").path("id").asString()));
        var todas = api.get("/receitas", treinador, 200);
        assertThat(todas.size()).isPositive();
        for (JsonNode r : todas) assertThat(r.get("origem").asString()).as(r.get("nome").asString()).isEqualTo("PADRAO");
        // O backfill da V115 casa tipo e nome: toda receita que o garantirPadrao cria precisa estar na lista dela.
        Set<String> daV115 = new HashSet<>();
        for (String[] par : V115__origem_da_receita.padroes()) daV115.add(par[0] + "/" + par[1]);
        for (Map<String, Object> linha : jdbc.queryForList("select tipo, nome from receita where consultoria_id = ?", consultoria)) {
            assertThat(daV115).contains(linha.get("tipo") + "/" + linha.get("nome"));
        }
    }

    @Test
    void criarDuplicarESalvarGravamConsultoriaEOClienteNaoForcaAOrigem() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        JsonNode padrao = api.get("/receitas?tipo=SERIES", treinador, 200).get(0);
        String padraoId = padrao.get("id").asString();

        // Criar com "origem": "PADRAO" no corpo: o campo não existe no pedido e a receita é da consultoria.
        var criada = api.post("/receitas", treinador, Map.of("tipo", "SERIES", "nome", "Minha fictícia", "origem", "PADRAO",
                "conteudo", padrao.get("conteudo")), 200);
        assertThat(criada.get("origem").asString()).isEqualTo("CONSULTORIA");
        String criadaId = criada.get("id").asString();
        assertThat(jdbc.queryForObject("select origem from receita where id = ?", String.class, UUID.fromString(criadaId)))
                .isEqualTo("CONSULTORIA");

        // Editar não muda a origem, nem a da padrão (vira "Minhas" só quem a equipe criou), nem com o campo no corpo.
        var editada = api.put("/receitas/" + padraoId, treinador, Map.of("tipo", "SERIES", "nome", "Padrão editada",
                "origem", "CONSULTORIA", "conteudo", padrao.get("conteudo"), "versao", padrao.get("versao").asLong()), 200);
        assertThat(editada.get("origem").asString()).isEqualTo("PADRAO");
        var minhaEditada = api.put("/receitas/" + criadaId, treinador, Map.of("tipo", "SERIES", "nome", "Minha editada",
                "origem", "PADRAO", "conteudo", padrao.get("conteudo"), "versao", criada.get("versao").asLong()), 200);
        assertThat(minhaEditada.get("origem").asString()).isEqualTo("CONSULTORIA");

        // Duplicar uma padrão dá uma receita da consultoria.
        var copia = api.post("/receitas/" + padraoId + "/duplicar", treinador, null, 200);
        assertThat(copia.get("origem").asString()).isEqualTo("CONSULTORIA");
    }

    @Test
    void aReceitaDeUmaConsultoriaNuncaApareceNaOutra() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var a = api.novoTreinador();
        var b = api.novoTreinador();
        JsonNode conteudo = api.get("/receitas?tipo=SERIES", a, 200).get(0).get("conteudo");
        String deA = api.post("/receitas", a, Map.of("tipo", "SERIES", "nome", "Só de A", "conteudo", conteudo), 200)
                .get("id").asString();

        var listaDeA = api.get("/receitas?tipo=SERIES", a, 200);
        assertThat(contem(listaDeA, deA)).isTrue();
        var listaDeB = api.get("/receitas?tipo=SERIES", b, 200);
        assertThat(contem(listaDeB, deA)).isFalse();
        // A "Minhas" de B (as de origem CONSULTORIA da lista dele) está vazia: B ainda não criou nenhuma.
        for (JsonNode r : listaDeB) assertThat(r.get("origem").asString()).isEqualTo("PADRAO");
        assertThat(contem(api.get("/receitas", b, 200), deA)).isFalse();
        api.get("/receitas/" + deA, b, 404);
        api.post("/receitas/" + deA + "/duplicar", b, null, 404);
        api.put("/receitas/" + deA, b, Map.of("tipo", "SERIES", "nome", "Tomada", "conteudo", conteudo), 404);
        api.delete("/receitas/" + deA, b, 404);
        assertThat(api.get("/receitas/" + deA, a, 200).get("nome").asString()).isEqualTo("Só de A");
    }
}
