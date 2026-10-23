package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import db.migration.V028__suplementos_heavy_suppz;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Connection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Suplementos da biblioteca: CRUD, isolamento, busca sem acento, filtro de categoria, permissões e link recusado. */
@AutoConfigureMockMvc
class SuplementoIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private static Map<String, Object> suplemento(String nome, String categoria, String link) {
        Map<String, Object> m = new HashMap<>();
        m.put("nome", nome);
        m.put("marca", "Marca de Teste");
        m.put("categoria", categoria);
        m.put("porcao", "1 dosador (3g)");
        m.put("porcoesPorEmbalagem", "cerca de 26");
        m.put("sabores", List.of("Sabor A", "Sabor B", "Sabor A", " "));
        m.put("link", link);
        return m;
    }

    @Test
    void criaListaAlteraEExcluiComSaboresSemRepeticao() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        JsonNode criado = api.post("/suplementos", login,
                suplemento("Item de teste A", "Creatina", "https://exemplo.com/produto"), 200);
        assertThat(criado.path("sabores")).hasSize(2);
        assertThat(criado.path("porcoesPorEmbalagem").asString()).isEqualTo("cerca de 26");
        assertThat(criado.path("link").asString()).isEqualTo("https://exemplo.com/produto");

        String id = criado.path("id").asString();
        Map<String, Object> novo = suplemento("Item de teste A", "Whey", null);
        novo.put("sabores", List.of());
        JsonNode alterado = api.put("/suplementos/" + id, login, novo, 200);
        assertThat(alterado.path("categoria").asString()).isEqualTo("Whey");
        assertThat(alterado.path("link").isNull()).isTrue();
        assertThat(alterado.path("sabores")).isEmpty();

        assertThat(api.get("/suplementos", login, 200)).hasSize(PADRAO + 1);
        api.delete("/suplementos/" + id, login, 204);
        assertThat(api.get("/suplementos", login, 200)).hasSize(PADRAO);
        api.delete("/suplementos/" + id, login, 404);
        // Excluir libera o nome.
        api.post("/suplementos", login, suplemento("Item de teste A", "Creatina", null), 200);
    }

    @Test
    void nomeRepetidoIgnoraAcentoEMaiusculas() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/suplementos", login, suplemento("Maçã Verde Teste", null, null), 200);
        assertThat(api.post("/suplementos", login, suplemento("maca verde teste", null, null), 409)
                .path("codigo").asString()).isEqualTo("NOME_EM_USO");
    }

    @Test
    void buscaSemAcentoEFiltroDeCategoria() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/suplementos", login, suplemento("Ômega Teste", "Vitaminas e minerais", null), 200);
        api.post("/suplementos", login, suplemento("Creatina Teste", "Creatina", null), 200);
        api.post("/suplementos", login, suplemento("Sem categoria Teste", null, null), 200);

        assertThat(api.get("/suplementos?busca=omega", login, 200)).hasSize(2);
        assertThat(api.get("/suplementos?busca=TESTE", login, 200)).hasSize(3);
        assertThat(api.get("/suplementos?busca=%25", login, 200)).isEmpty();
        assertThat(api.get("/suplementos?categoria=Creatina", login, 200)).hasSize(1);
        assertThat(api.get("/suplementos?categoria=Creatina&busca=omega", login, 200)).isEmpty();
    }

    @Test
    void linkRecusadoDa400ComOErroNoCampoLink() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        for (String ruim : new String[] {"javascript:alert(1)", "data:text/html,oi", "http://exemplo.com/x",
                "https://usuario:senha@exemplo.com/x", "https:///sem-host", "exemplo.com/x"}) {
            JsonNode erro = api.post("/suplementos", login, suplemento("Item de teste B", null, ruim), 400);
            assertThat(erro.path("codigo").asString()).as(ruim).isEqualTo("DADOS_INVALIDOS");
            assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()).toList())
                    .as(ruim).contains("link");
        }
        assertThat(api.get("/suplementos", login, 200)).hasSize(PADRAO);
    }

    @Test
    void outraConsultoriaNaoVeNemAlteraNemExclui() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var dona = api.novoTreinador();
        var outra = api.novoTreinador();
        String id = api.post("/suplementos", dona, suplemento("Item de teste C", "Creatina", null), 200).path("id").asString();

        assertThat(api.get("/suplementos", outra, 200)).hasSize(PADRAO);
        api.put("/suplementos/" + id, outra, suplemento("Item de teste C", null, null), 404);
        api.delete("/suplementos/" + id, outra, 404);
        // O mesmo nome é livre na outra consultoria.
        api.post("/suplementos", outra, suplemento("Item de teste C", null, null), 200);
        assertThat(api.get("/suplementos", dona, 200)).hasSize(PADRAO + 1);
    }

    @Test
    void lerExigeBibliotecaLerEAlterarExigeBibliotecaAlterar() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/suplementos", login, suplemento("Item de teste D", null, null), 200);
        trocarPerfil(login, "Assistente");
        assertThat(api.get("/suplementos", login, 200)).hasSize(PADRAO + 1);
        assertThat(api.post("/suplementos", login, suplemento("Item de teste E", null, null), 403)
                .path("codigo").asString()).isEqualTo("PERMISSAO_NEGADA");
        trocarPerfil(login, "Administrador");
        api.post("/suplementos", login, suplemento("Item de teste E", null, null), 200);
    }

    @Test
    void consultoriaNovaRecebeHeavySuppzENaoApagaPorcaoDigitada() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        JsonNode lista = api.get("/suplementos", login, 200);
        assertThat(lista).hasSize(PADRAO);
        JsonNode dose = lista.valueStream().filter(s -> s.path("nome").asString().startsWith("Dose única")).findFirst().orElseThrow();
        assertThat(dose.path("porcao").isNull()).isTrue();
        assertThat(dose.path("marca").asString()).isEqualTo("Heavy Suppz");
        JsonNode creatina = lista.valueStream().filter(s -> s.path("nome").asString().startsWith("Creatina Monohidratada")).findFirst().orElseThrow();
        Map<String, Object> digitada = suplemento(creatina.path("nome").asString(), creatina.path("categoria").asString(), creatina.path("link").asString());
        digitada.put("porcao", "porção digitada");
        digitada.put("marca", "Heavy Suppz");
        digitada.put("sabores", List.of());
        api.put("/suplementos/" + creatina.path("id").asString(), login, digitada, 200);

        String email = login.path("usuario").path("email").asString();
        var consultoria = jdbc.queryForObject("select consultoria_id from usuario where email = ?", java.util.UUID.class, email);
        try (Connection conexao = jdbc.getDataSource().getConnection()) {
            assertThat(V028__suplementos_heavy_suppz.gravarFaltantes(conexao, consultoria, json)).isZero();
        }
        JsonNode deNovo = api.get("/suplementos", login, 200);
        assertThat(deNovo).hasSize(PADRAO);
        JsonNode mantida = deNovo.valueStream().filter(s -> s.path("id").asString().equals(creatina.path("id").asString())).findFirst().orElseThrow();
        assertThat(mantida.path("porcao").asString()).isEqualTo("porção digitada");
    }

    private static final int PADRAO = 22;

    private void trocarPerfil(JsonNode login, String nome) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), nome);
    }
}
