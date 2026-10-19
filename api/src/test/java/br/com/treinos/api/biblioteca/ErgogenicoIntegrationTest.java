package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Medicação e ergogênicos da biblioteca: CRUD, isolamento, busca, unicidade por concentração e permissões próprias. */
@AutoConfigureMockMvc
class ErgogenicoIntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private static Map<String, Object> item(String nome, String categoria, String concentracao, String apresentacao) {
        Map<String, Object> m = new HashMap<>();
        m.put("categoria", categoria);
        m.put("nome", nome);
        m.put("principioAtivo", "Princípio de Teste");
        m.put("concentracao", concentracao);
        m.put("apresentacao", apresentacao);
        m.put("observacao", null);
        return m;
    }

    @Test
    void criaListaAlteraEExcluiSemCamposDeDoseOuIndicacao() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        JsonNode criado = api.post("/ergogenicos", login, item("Item de teste A", "Injetaveis", "200 mg/ml", "10 ml"), 200);
        assertThat(criado.path("categoria").asString()).isEqualTo("Injetaveis");
        assertThat(criado.path("concentracao").asString()).isEqualTo("200 mg/ml");
        assertThat(criado.propertyNames()).containsExactlyInAnyOrder(
                "id", "categoria", "nome", "principioAtivo", "concentracao", "apresentacao", "observacao");

        String id = criado.path("id").asString();
        Map<String, Object> novo = item("Item de teste A", "Orais", null, "50 caps");
        novo.put("observacao", "Observação de teste");
        JsonNode alterado = api.put("/ergogenicos/" + id, login, novo, 200);
        assertThat(alterado.path("categoria").asString()).isEqualTo("Orais");
        assertThat(alterado.path("concentracao").isNull()).isTrue();
        assertThat(alterado.path("observacao").asString()).isEqualTo("Observação de teste");

        assertThat(api.get("/ergogenicos", login, 200)).hasSize(1);
        api.delete("/ergogenicos/" + id, login, 204);
        assertThat(api.get("/ergogenicos", login, 200)).isEmpty();
        api.delete("/ergogenicos/" + id, login, 404);
        // Excluir libera o nome.
        api.post("/ergogenicos", login, item("Item de teste A", "Orais", null, "50 caps"), 200);
    }

    @Test
    void mesmaSubstanciaComConcentracoesDiferentesPodeRepetirIguaisNao() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/ergogenicos", login, item("Item de teste B", "Injetaveis", "100 mg/ml", "10 ml"), 200);
        api.post("/ergogenicos", login, item("Item de teste B", "Injetaveis", "200 mg/ml", "10 ml"), 200);
        api.post("/ergogenicos", login, item("Item de teste B", "Injetaveis", "200 mg/ml", "5 ml"), 200);
        assertThat(api.post("/ergogenicos", login, item("item de TESTE b", "Injetaveis", "200 mg/ml", "10 ml"), 409)
                .path("codigo").asString()).isEqualTo("NOME_EM_USO");
        // Concentração e apresentação ausentes também contam como iguais.
        api.post("/ergogenicos", login, item("Item de teste C", "Outros", null, null), 200);
        api.post("/ergogenicos", login, item("Item de teste C", "Outros", " ", null), 409);
        // Alterar para o próprio valor não conflita.
        String id = api.post("/ergogenicos", login, item("Item de teste D", "Outros", "1 mg", null), 200).path("id").asString();
        api.put("/ergogenicos/" + id, login, item("Item de teste D", "Medicamentos", "1 mg", null), 200);
    }

    @Test
    void buscaSemAcentoNoNomeENoPrincipioAtivoEFiltroDeCategoria() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        Map<String, Object> a = item("Ômega Teste", "Orais", "1 g", "60 caps");
        a.put("principioAtivo", "Ácido Teste");
        api.post("/ergogenicos", login, a, 200);
        api.post("/ergogenicos", login, item("Peptídeo Teste", "Peptideos", "5 mg", "vial"), 200);
        api.post("/ergogenicos", login, item("Outro Teste", "Outros", null, null), 200);

        assertThat(api.get("/ergogenicos?busca=omega", login, 200)).hasSize(1);
        assertThat(api.get("/ergogenicos?busca=acido", login, 200)).hasSize(1);
        assertThat(api.get("/ergogenicos?busca=PRINCIPIO", login, 200)).hasSize(2);
        assertThat(api.get("/ergogenicos?busca=%25", login, 200)).isEmpty();
        assertThat(api.get("/ergogenicos?categoria=Peptideos", login, 200)).hasSize(1);
        assertThat(api.get("/ergogenicos?categoria=Peptideos&busca=omega", login, 200)).isEmpty();
        assertThat(api.get("/ergogenicos", login, 200)).hasSize(3);
    }

    @Test
    void categoriaLivreEOpcionalMasNomeObrigatorio() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/ergogenicos", login, item("Item de teste E", "x".repeat(61), null, null), 400);
        api.post("/ergogenicos", login, item(" ", "Orais", null, null), 400);
        api.post("/ergogenicos", login, item("x".repeat(121), "Orais", null, null), 400);
        assertThat(api.get("/ergogenicos", login, 200)).isEmpty();
        // Categoria é do treinador (V009): qualquer texto, ou nenhuma; em branco vira nula.
        assertThat(api.post("/ergogenicos", login, item("Item de teste E", "Minha categoria", null, null), 200)
                .path("categoria").asString()).isEqualTo("Minha categoria");
        assertThat(api.post("/ergogenicos", login, item("Item de teste F", "  ", null, null), 200)
                .path("categoria").isNull()).isTrue();
        assertThat(api.post("/ergogenicos", login, item("Item de teste G", null, null, null), 200)
                .path("categoria").isNull()).isTrue();
        assertThat(api.get("/ergogenicos?categoria=INVENTADA", login, 200)).isEmpty();
    }

    @Test
    void outraConsultoriaNaoVeNemAlteraNemExclui() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var dona = api.novoTreinador();
        var outra = api.novoTreinador();
        String id = api.post("/ergogenicos", dona, item("Item de teste F", "Orais", "1 mg", null), 200).path("id").asString();

        assertThat(api.get("/ergogenicos", outra, 200)).isEmpty();
        api.put("/ergogenicos/" + id, outra, item("Item de teste F", "Orais", "1 mg", null), 404);
        api.delete("/ergogenicos/" + id, outra, 404);
        // O mesmo item é livre na outra consultoria.
        api.post("/ergogenicos", outra, item("Item de teste F", "Orais", "1 mg", null), 200);
        assertThat(api.get("/ergogenicos", dona, 200)).hasSize(1);
    }

    @Test
    void soQuemTemErgogenicoLerEAlterarAcessa() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        String id = api.post("/ergogenicos", login, item("Item de teste G", "Orais", "1 mg", null), 200).path("id").asString();

        // Perfis padrão fora o Administrador não têm as permissões novas, nem a Nutricionista.
        for (String perfil : new String[] {"Treinador", "Nutricionista", "Assistente"}) {
            trocarPerfil(login, perfil);
            assertThat(api.get("/ergogenicos", login, 403).path("codigo").asString()).as(perfil).isEqualTo("PERMISSAO_NEGADA");
            api.post("/ergogenicos", login, item("Item de teste H", "Orais", null, null), 403);
            api.put("/ergogenicos/" + id, login, item("Item de teste G", "Orais", "1 mg", null), 403);
            api.delete("/ergogenicos/" + id, login, 403);
        }
        trocarPerfil(login, "Administrador");
        assertThat(api.get("/ergogenicos", login, 200)).hasSize(1);
    }

    @Test
    void perfilComSoLerListaMasNaoGrava() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        api.post("/ergogenicos", login, item("Item de teste I", "Orais", "1 mg", null), 200);
        trocarPerfil(login, "Assistente");
        jdbc.update("insert into perfil_permissao(perfil_id, codigo) select p.id, 'ERGOGENICO_LER' from perfil p "
                + "join usuario u on u.perfil_id = p.id where u.id = ?::uuid", login.path("usuario").path("id").asString());
        assertThat(api.get("/ergogenicos", login, 200)).hasSize(1);
        api.post("/ergogenicos", login, item("Item de teste J", "Orais", null, null), 403);
    }

    private void trocarPerfil(JsonNode login, String nome) {
        jdbc.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", login.path("usuario").path("id").asString(), nome);
    }
}
