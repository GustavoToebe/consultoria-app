package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Suplementos da biblioteca: CRUD, isolamento, busca sem acento, filtro de categoria, permissões e link recusado. */
@AutoConfigureMockMvc
class SuplementoIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private BibliotecaService biblioteca;

    private static Map<String, Object> suplemento(String nome, String categoria, String link) {
        Map<String, Object> m = new HashMap<>();
        m.put("nome", nome);
        m.put("marca", "Marca de Teste");
        m.put("tipo", "SUPLEMENTO");
        m.put("grupo", categoria);
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
        JsonNode criado = api.post("/alimentos?tipo=SUPLEMENTO", login,
                suplemento("Item de teste A", "Creatina", "https://exemplo.com/produto"), 200);
        assertThat(criado.path("sabores")).hasSize(2);
        assertThat(criado.path("porcoesPorEmbalagem").asString()).isEqualTo("cerca de 26");
        assertThat(criado.path("link").asString()).isEqualTo("https://exemplo.com/produto");

        String id = criado.path("id").asString();
        Map<String, Object> novo = suplemento("Item de teste A", "Whey", null);
        novo.put("sabores", List.of());
        JsonNode alterado = api.put("/alimentos/" + id, login, novo, 200);
        assertThat(alterado.path("grupo").asString()).isEqualTo("Whey");
        assertThat(alterado.path("link").isNull()).isTrue();
        assertThat(alterado.path("sabores")).isEmpty();

        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", login, 200)).hasSize(PADRAO + 1);
        api.delete("/alimentos/" + id, login, 204);
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", login, 200)).hasSize(PADRAO);
        api.delete("/alimentos/" + id, login, 404);
        // Excluir libera o nome.
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Item de teste A", "Creatina", null), 200);
    }

    @Test
    void cupomCriaEditaComStripEEmBrancoViraNulo() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        Map<String, Object> corpo = suplemento("Item de teste CP", null, null);
        corpo.put("cupom", "  TESTE10  ");
        JsonNode criado = api.post("/alimentos?tipo=SUPLEMENTO", login, corpo, 200);
        assertThat(criado.path("cupom").asString()).isEqualTo("TESTE10");
        String id = criado.path("id").asString();
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", login, 200).valueStream()
                .filter(s -> s.path("id").asString().equals(id)).findFirst().orElseThrow().path("cupom").asString())
                .isEqualTo("TESTE10");

        corpo.put("cupom", "TESTE20");
        assertThat(api.put("/alimentos/" + id, login, corpo, 200).path("cupom").asString()).isEqualTo("TESTE20");
        corpo.put("cupom", "C".repeat(40));
        assertThat(api.put("/alimentos/" + id, login, corpo, 200).path("cupom").asString()).hasSize(40);
        corpo.put("cupom", "   ");
        assertThat(api.put("/alimentos/" + id, login, corpo, 200).path("cupom").isNull()).isTrue();
        corpo.remove("cupom");
        assertThat(api.put("/alimentos/" + id, login, corpo, 200).path("cupom").isNull()).isTrue();
    }

    @Test
    void cupomComMaisDe40CaracteresDa422NoCampoSemRepetirOValor() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        String longo = "X".repeat(41);
        Map<String, Object> corpo = suplemento("Item de teste CL", null, null);
        corpo.put("cupom", longo);
        JsonNode erro = api.post("/alimentos?tipo=SUPLEMENTO", login, corpo, 422);
        assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()).toList())
                .containsExactly("cupom");
        assertThat(erro.toString()).doesNotContain(longo);
        // O strip vem antes da contagem: 40 mais espaços passa, 41 depois do strip não.
        corpo.put("cupom", "  " + "X".repeat(40) + "  ");
        String id = api.post("/alimentos?tipo=SUPLEMENTO", login, corpo, 200).path("id").asString();
        corpo.put("cupom", " " + longo + " ");
        JsonNode naEdicao = api.put("/alimentos/" + id, login, corpo, 422);
        assertThat(naEdicao.path("fieldErrors").valueStream().map(f -> f.path("field").asString()).toList())
                .containsExactly("cupom");
        assertThat(naEdicao.toString()).doesNotContain(longo);
    }

    @Test
    void nomeRepetidoIgnoraAcentoEMaiusculas() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Maçã Verde Teste", null, null), 200);
        assertThat(api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("maca verde teste", null, null), 409)
                .path("codigo").asString()).isEqualTo("NOME_EM_USO");
    }

    @Test
    void buscaSemAcentoEFiltroDeCategoria() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Ômega Teste", "Vitaminas e minerais", null), 200);
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Creatina Teste", "Rotulada", null), 200);
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Sem categoria Teste", null, null), 200);

        assertThat(api.get("/alimentos?tipo=SUPLEMENTO&busca=omega", login, 200)).hasSize(2);
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO&busca=TESTE", login, 200)).hasSize(3);
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO&busca=%25", login, 200)).isEmpty();
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO&grupo=Rotulada", login, 200)).hasSize(1);
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO&grupo=Rotulada&busca=omega", login, 200)).isEmpty();
    }

    @Test
    void linkRecusadoDa400ComOErroNoCampoLink() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        for (String ruim : new String[] {"javascript:alert(1)", "data:text/html,oi", "http://exemplo.com/x",
                "https://usuario:senha@exemplo.com/x", "https:///sem-host", "exemplo.com/x"}) {
            JsonNode erro = api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Item de teste B", null, ruim), 400);
            assertThat(erro.path("codigo").asString()).as(ruim).isEqualTo("DADOS_INVALIDOS");
            assertThat(erro.path("fieldErrors").valueStream().map(f -> f.path("field").asString()).toList())
                    .as(ruim).contains("link");
        }
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", login, 200)).hasSize(PADRAO);
    }

    @Test
    void outraConsultoriaNaoVeNemAlteraNemExclui() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var dona = api.novoTreinador();
        var outra = api.novoTreinador();
        String id = api.post("/alimentos?tipo=SUPLEMENTO", dona, suplemento("Item de teste C", "Creatina", null), 200).path("id").asString();

        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", outra, 200)).hasSize(PADRAO);
        api.put("/alimentos/" + id, outra, suplemento("Item de teste C", null, null), 404);
        api.delete("/alimentos/" + id, outra, 404);
        // O mesmo nome é livre na outra consultoria.
        api.post("/alimentos?tipo=SUPLEMENTO", outra, suplemento("Item de teste C", null, null), 200);
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", dona, 200)).hasSize(PADRAO + 1);
    }

    @Test
    void cupomDeUmaConsultoriaNaoApareceNaOutra() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var dona = api.novoTreinador();
        var outra = api.novoTreinador();
        Map<String, Object> corpo = suplemento("Item de teste CI", null, null);
        corpo.put("cupom", "TESTE10");
        String id = api.post("/alimentos?tipo=SUPLEMENTO", dona, corpo, 200).path("id").asString();
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", outra, 200).toString()).doesNotContain(id).doesNotContain("TESTE10");
        corpo.put("cupom", "OUTRO");
        api.put("/alimentos/" + id, outra, corpo, 404);
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", dona, 200).valueStream().filter(s -> s.path("id").asString().equals(id))
                .findFirst().orElseThrow().path("cupom").asString()).isEqualTo("TESTE10");
    }

    @Test
    void lerExigeBibliotecaLerEAlterarExigeBibliotecaAlterar() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Item de teste D", null, null), 200);
        trocarPerfil(login, "Assistente");
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", login, 200)).hasSize(PADRAO + 1);
        assertThat(api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Item de teste E", null, null), 403)
                .path("codigo").asString()).isEqualTo("PERMISSAO_NEGADA");
        trocarPerfil(login, "Administrador");
        api.post("/alimentos?tipo=SUPLEMENTO", login, suplemento("Item de teste E", null, null), 200);
    }

    @Test
    void consultoriaNovaRecebeHeavySuppzENaoApagaPorcaoDigitada() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        JsonNode lista = api.get("/alimentos?tipo=SUPLEMENTO", login, 200);
        assertThat(lista).hasSize(PADRAO);
        JsonNode dose = lista.valueStream().filter(s -> s.path("nome").asString().startsWith("Dose única")).findFirst().orElseThrow();
        assertThat(dose.path("porcao").isNull()).isTrue();
        assertThat(dose.path("marca").asString()).isEqualTo("Heavy Suppz");
        JsonNode creatina = lista.valueStream().filter(s -> s.path("nome").asString().startsWith("Creatina Monohidratada")).findFirst().orElseThrow();
        assertThat(creatina.path("tipo").asString()).isEqualTo("SUPLEMENTO");
        assertThat(creatina.path("kcal").isNull()).isTrue();
        Map<String, Object> digitada = suplemento(creatina.path("nome").asString(), creatina.path("grupo").asString(), creatina.path("link").asString());
        digitada.put("porcao", "porção digitada");
        digitada.put("marca", "Heavy Suppz");
        digitada.put("sabores", List.of());
        api.put("/alimentos/" + creatina.path("id").asString(), login, digitada, 200);

        JsonNode whey = lista.valueStream().filter(s -> s.path("nome").asString().equals(BibliotecaService.WHEY)).findFirst().orElseThrow();
        assertThat(whey.path("marca").isNull()).isTrue();
        assertThat(whey.path("baseQuantidade").decimalValue()).isEqualByComparingTo("30");
        assertThat(whey.path("kcal").decimalValue()).isEqualByComparingTo("124");
        assertThat(whey.path("proteina").decimalValue()).isEqualByComparingTo("24");
        assertThat(whey.path("carboidrato").decimalValue()).isEqualByComparingTo("2.3");
        assertThat(whey.path("gordura").decimalValue()).isEqualByComparingTo("2.1");
        assertThat(whey.path("porcoesPorEmbalagem").asString()).isEqualTo("cerca de 33");
        Map<String, Object> edicaoWhey = suplemento(BibliotecaService.WHEY, null, null);
        edicaoWhey.put("marca", null);
        JsonNode wheyEditado = api.put("/alimentos/" + whey.path("id").asString(), login, edicaoWhey, 200);
        assertThat(wheyEditado.path("kcal").decimalValue()).isEqualByComparingTo("124");
        assertThat(wheyEditado.path("baseQuantidade").decimalValue()).isEqualByComparingTo("30");
        assertThat(api.get("/alimentos", login, 200).toString()).doesNotContain(BibliotecaService.WHEY);

        String email = login.path("usuario").path("email").asString();
        var consultoria = jdbc.queryForObject("select consultoria_id from usuario where email = ?", UUID.class, email);
        TenantContext.executarComo(consultoria, () -> {
            biblioteca.garantirSuplementosPadrao();
            return null;
        });
        JsonNode deNovo = api.get("/alimentos?tipo=SUPLEMENTO", login, 200);
        assertThat(deNovo).hasSize(PADRAO);
        JsonNode mantida = deNovo.valueStream().filter(s -> s.path("id").asString().equals(creatina.path("id").asString())).findFirst().orElseThrow();
        assertThat(mantida.path("porcao").asString()).isEqualTo("porção digitada");
        assertThat(jdbc.queryForObject("select to_regclass('public.suplemento')", String.class)).isNull();
    }

    @Test
    void consultoriaNovaJaVemSemOPrefixoDasCategorias() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        assertThat(api.get("/alimentos?tipo=SUPLEMENTO", login, 200).valueStream().map(s -> s.path("grupo").asString()))
                .isNotEmpty().noneMatch(c -> c.startsWith("Suplementos / "));
    }

    /** 22 da Heavy Suppz mais o Whey Protein do rótulo. */
    private static final int PADRAO = 23;

    private void trocarPerfil(JsonNode login, String nome) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), nome);
    }
}
