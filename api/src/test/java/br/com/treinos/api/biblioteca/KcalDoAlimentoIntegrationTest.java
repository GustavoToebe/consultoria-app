package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * C48: o kcal do alimento (não do suplemento) é calculado no servidor, proteína × 4 + carboidrato × 4 + gordura × 9, a
 * partir dos macros que o treinador digitou; o kcal do corpo é ignorado. Trava obrigatória: as preparações do Batel
 * Grill (V030) só têm nome e caloria, e nada disso pode apagar, zerar ou esconder essa caloria. Dados fictícios.
 */
@AutoConfigureMockMvc
class KcalDoAlimentoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private BibliotecaService biblioteca;

    private static Map<String, Object> alimento(String nome, Object kcal, Object p, Object c, Object g) {
        Map<String, Object> m = new HashMap<>();
        m.put("nome", nome);
        m.put("baseQuantidade", 100);
        m.put("baseUnidade", "g");
        m.put("kcal", kcal);
        m.put("proteina", p);
        m.put("carboidrato", c);
        m.put("gordura", g);
        return m;
    }

    /** Alimento como o do Batel Grill na V030: origem do catálogo, só nome e caloria, macros nulos. */
    private UUID inserirSoComKcal(JsonNode login, String nome, String kcal) {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where email = ?", UUID.class,
                login.path("usuario").path("email").asString());
        UUID id = UUID.randomUUID();
        jdbc.update("insert into alimento (id, consultoria_id, nome, kcal, origem) values (?::uuid, ?::uuid, ?, ?::numeric, 'CATALOGO')",
                id, consultoria, nome, kcal);
        return id;
    }

    private static JsonNode da(JsonNode lista, UUID id) {
        return StreamSupport.stream(lista.spliterator(), false).filter(a -> a.path("id").asString().equals(id.toString()))
                .findFirst().orElseThrow();
    }

    private BigDecimal kcalGravado(UUID id) {
        return jdbc.queryForObject("select kcal from alimento where id = ?::uuid", BigDecimal.class, id);
    }

    @Test
    void alimentoSoComKcalComoOdoBatelMantemACaloriaNoGetNaRecusaESoMudaComOsTresMacros() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID id = inserirSoComKcal(login, "Preparação fictícia sem macros", "321.50");

        // (a) o GET devolve a caloria gravada e os macros nulos (nunca zero).
        JsonNode lido = da(api.get("/alimentos", login, 200), id);
        assertThat(lido.path("kcal").decimalValue()).isEqualByComparingTo("321.50");
        assertThat(lido.path("proteina").isNull()).isTrue();
        assertThat(lido.path("carboidrato").isNull()).isTrue();
        assertThat(lido.path("gordura").isNull()).isTrue();

        // (b) editar sem macros segue recusado (422 ALIMENTO_INVALIDO nos três macros) e não mexe no kcal, mesmo com kcal no corpo.
        JsonNode erro = api.put("/alimentos/" + id, login,
                alimento("Preparação fictícia sem macros", 999, null, null, null), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALIMENTO_INVALIDO");
        assertThat(StreamSupport.stream(erro.path("fieldErrors").spliterator(), false).map(f -> f.path("field").asString()))
                .containsExactlyInAnyOrder("proteina", "carboidrato", "gordura");
        assertThat(kcalGravado(id)).isEqualByComparingTo("321.50");
        assertThat(da(api.get("/alimentos", login, 200), id).path("kcal").decimalValue()).isEqualByComparingTo("321.50");

        // Faltando só um macro também recusa, e o kcal fica.
        api.put("/alimentos/" + id, login, alimento("Preparação fictícia sem macros", null, 10, 20, null), 422);
        assertThat(kcalGravado(id)).isEqualByComparingTo("321.50");

        // (c) com os três macros grava o derivado: 10 × 4 + 20 × 4 + 5 × 9 = 165.
        JsonNode editado = api.put("/alimentos/" + id, login,
                alimento("Preparação fictícia sem macros", 999, 10, 20, 5), 200);
        assertThat(editado.path("kcal").decimalValue()).isEqualByComparingTo("165.00");
        assertThat(kcalGravado(id)).isEqualByComparingTo("165.00");
    }

    @Test
    void kcalDoCorpoEIgnoradoNoCriarENoEditarEOServidorCalculaEmDuasCasas() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();

        // (d) kcal que não bate com os macros é ignorado; a conta é exata em duas casas: 10 + 112,4 + 1,8.
        JsonNode criado = api.post("/alimentos", login, alimento("Arroz fictício A", 1, 2.5, 28.1, 0.2), 200);
        assertThat(criado.path("kcal").decimalValue()).isEqualByComparingTo("124.20");
        String id = criado.path("id").asString();

        // Sem kcal no corpo também vale (o campo saiu do formulário).
        JsonNode semKcal = api.post("/alimentos", login, alimento("Feijão fictício B", null, 100, 0, 0), 200);
        assertThat(semKcal.path("kcal").decimalValue()).isEqualByComparingTo("400.00");

        JsonNode editado = api.put("/alimentos/" + id, login, alimento("Arroz fictício A", 99999, 0, 0, 100), 200);
        assertThat(editado.path("kcal").decimalValue()).isEqualByComparingTo("900.00");

        // Tudo zerado é um valor: 0 kcal, não nulo.
        JsonNode zerado = api.post("/alimentos", login, alimento("Água fictícia C", 50, 0, 0, 0), 200);
        assertThat(zerado.path("kcal").decimalValue()).isEqualByComparingTo("0.00");

        // O que o cliente manda sem macros continua recusado, sem exigir o kcal.
        JsonNode erro = api.post("/alimentos", login, alimento("Sem macros fictício D", 100, null, null, null), 422);
        assertThat(StreamSupport.stream(erro.path("fieldErrors").spliterator(), false).map(f -> f.path("field").asString()))
                .doesNotContain("kcal");
    }

    @Test
    void kcalDerivadoQueNaoCabeNoTetoDaColunaDa422EmVezDeErro500() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        JsonNode erro = api.post("/alimentos", login, alimento("Absurdo fictício", null, 99999, 99999, 99999), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALIMENTO_INVALIDO");
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("proteina");
    }

    @Test
    void fatoresEstimadosUsamOKcalDerivadoENaoOQueVeioNoCorpo() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        // Arroz cru (sem "cozido") com 250 kcal ou mais por 100 g é "cru ou pronto" (FCc 1,00); abaixo disso, grão cozido.
        JsonNode denso = api.post("/alimentos", login, alimento("Arroz fictício denso", 10, 80, 0, 0), 200);
        assertThat(denso.path("fatorCoccao").decimalValue()).isEqualByComparingTo("1.00");
        JsonNode leve = api.post("/alimentos", login, alimento("Arroz fictício leve", 900, 10, 0, 0), 200);
        assertThat(leve.path("fatorCoccao").decimalValue()).isGreaterThan(BigDecimal.ONE);
    }

    @Test
    void seedSemKcalDa422ClaroEmVezDeErro500ESeedComKcalMantemOInformado() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where email = ?", UUID.class,
                api.novoTreinador().path("usuario").path("email").asString());
        // A coluna kcal é obrigatória no alimento: seed sem kcal era NullPointerException (500). Agora é recusa clara e nada é gravado
        // (ausente não vira zero nem é derivado).
        var semKcal = new AlimentoRequest("Seed fictício sem kcal", new BigDecimal("100"), "g", null, new BigDecimal("10"),
                new BigDecimal("20"), new BigDecimal("5"), null, null, null, null, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> TenantContext.executarComo(consultoria, () -> biblioteca.criarAlimentoDeSeed(semKcal)))
                .isInstanceOf(ValidacaoException.class);
        assertThat(jdbc.queryForObject("select count(*) from alimento where nome = 'Seed fictício sem kcal' and consultoria_id = ?::uuid",
                Integer.class, consultoria)).isZero();
        // Com kcal, mantém o informado (não deriva dos macros).
        var comKcal = TenantContext.executarComo(consultoria, () -> biblioteca.criarAlimentoDeSeed(new AlimentoRequest(
                "Seed fictício com kcal", new BigDecimal("100"), "g", new BigDecimal("321.5"), new BigDecimal("10"),
                new BigDecimal("20"), new BigDecimal("5"), null, null, null, null, null, null, null, null, null, null, null, null)));
        assertThat(comKcal.kcal()).isEqualByComparingTo("321.5");
    }

    @Test
    void suplementoSemMacrosMantemOKcalGravadoEUsaOKcalDoCorpo() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", "Suplemento fictício E");
        corpo.put("tipo", "SUPLEMENTO");
        corpo.put("kcal", 50);

        // (e) o suplemento não deriva: o kcal do corpo vale, mesmo sem macros...
        JsonNode criado = api.post("/alimentos", login, corpo, 200);
        assertThat(criado.path("kcal").decimalValue()).isEqualByComparingTo("50");
        assertThat(criado.path("proteina").isNull()).isTrue();
        String id = criado.path("id").asString();

        // ...e a edição sem kcal nem macros (o formulário do suplemento não os envia) deixa o gravado.
        corpo.remove("kcal");
        corpo.put("marca", "Marca de Teste");
        assertThat(api.put("/alimentos/" + id, login, corpo, 200).path("kcal").decimalValue()).isEqualByComparingTo("50");

        // Com macros e kcal que não bate, o suplemento guarda o que veio (rótulo, não conta).
        corpo.put("kcal", 10);
        corpo.put("proteina", 24);
        assertThat(api.put("/alimentos/" + id, login, corpo, 200).path("kcal").decimalValue()).isEqualByComparingTo("10");
    }
}
