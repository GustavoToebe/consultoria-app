package br.com.treinos.api.receitas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.biblioteca.SuplementosPadrao;
import br.com.treinos.api.biblioteca.WheyDoRotulo;
import br.com.treinos.api.receitas.DietasPadrao.Nutrientes;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Buscas;
import db.migration.V062__dietas_padrao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Consultoria nova recebe as dietas com alimento do catálogo; repetir não duplica nem mexe no que o treinador tem. */
@AutoConfigureMockMvc
class DietasPadraoIntegrationTest extends AbstractIntegrationTest {

    private static final Set<String> MANUAIS = Set.of(
            "Pão de forma branco",
            "Semente de chia",
            "Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi)",
            "Legumes (brócolis, abobrinha, chuchu, beterraba, vagem ou tomate)");
    private static final String FRANGO = "Frango, peito, sem pele, grelhado";
    private static final String OVO = "Ovo, de galinha, inteiro, cozido/10minutos";
    private static final String ARROZ = "Arroz, tipo 1, cozido";
    private static final String BANANA = "Banana, prata, crua";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private DataSource dataSource;
    @Autowired private ReceitaService receitas;

    @Test
    void consultoriaNovaResolveOAlimentoENaoDuplica() throws Exception {
        UUID consultoria = consultoriaNova();
        assertThat(contarReceitas(consultoria)).isEqualTo(SemanasPadrao.totalNaConsultoriaNova());
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'PLANO_DIETA' "
                + "and pasta_id is not null", Long.class, consultoria)).isZero();
        for (DietasPadrao.Modelo modelo : DietasPadrao.modelos()) {
            conferirDieta(consultoria, modelo.nome(), Set.of());
        }
        assertThat(contar("select count(*) from alimento where consultoria_id = ? and nome = ?", consultoria,
                "Peito de frango grelhado")).isZero();
        assertThat(jdbc.queryForObject("select codigo_fonte from catalogo_alimento where nome = ?", String.class, FRANGO))
                .isEqualTo("410");

        long receitasAntes = contarReceitas(consultoria);
        long alimentosAntes = contar("select count(*) from alimento where consultoria_id = ?", consultoria);
        TenantContext.executarComo(consultoria, () -> {
            receitas.garantirPadrao();
            return null;
        });
        assertThat(contarReceitas(consultoria)).isEqualTo(receitasAntes);
        assertThat(contar("select count(*) from alimento where consultoria_id = ?", consultoria)).isEqualTo(alimentosAntes);

        assertThat(jdbc.update("update alimento set kcal = 1 where consultoria_id = ? and nome = ?", consultoria, ARROZ))
                .isEqualTo(1);
        TenantContext.executarComo(consultoria, () -> {
            receitas.garantirPadrao();
            return null;
        });
        assertThat(kcalDe(consultoria, ARROZ)).isEqualByComparingTo("1");
        assertThat(contar("select count(*) from alimento where consultoria_id = ? and nome = ?", consultoria, ARROZ))
                .isEqualTo(1L);
    }

    @Test
    void migrationNaoDuplicaENaoAlteraOAlimentoDoTreinador() throws Exception {
        UUID consultoria = consultoriaNova();
        assertThat(jdbc.update("update alimento set kcal = 1 where consultoria_id = ? and nome = ?", consultoria, ARROZ))
                .isEqualTo(1);
        assertThat(jdbc.update("update alimento set ativo = false where consultoria_id = ? and nome = ?", consultoria, BANANA))
                .isEqualTo(1);
        jdbc.update("delete from alimento where consultoria_id = ? and origem = 'CATALOGO' and nome not in (?, ?)",
                consultoria, ARROZ, BANANA);
        apagarAsDietas(consultoria);
        jdbc.update("delete from alimento where consultoria_id = ? and tipo = 'SUPLEMENTO'", consultoria);

        try (Connection conexao = dataSource.getConnection()) {
            V062__dietas_padrao.aplicar(conexao, consultoria);
        }
        assertThat(contar("select count(*) from alimento where consultoria_id = ? and tipo = 'SUPLEMENTO'", consultoria))
                .isEqualTo(SuplementosPadrao.itens(json).size() + 1L);
        assertThat(kcalDe(consultoria, ARROZ)).isEqualByComparingTo("1");
        assertThat(contar("select count(*) from alimento where consultoria_id = ? and nome = ?", consultoria, ARROZ))
                .isEqualTo(1L);
        assertThat(jdbc.queryForObject("select ativo from alimento where consultoria_id = ? and nome = ?", Boolean.class,
                consultoria, BANANA)).isFalse();
        assertThat(contar("select count(*) from alimento where consultoria_id = ? and nome = ?", consultoria, BANANA))
                .isEqualTo(1L);
        assertThat(kcalDe(consultoria, FRANGO)).isEqualByComparingTo(kcalDoCatalogo(FRANGO));
        for (DietasPadrao.Modelo modelo : DietasPadrao.modelos()) {
            conferirDieta(consultoria, modelo.nome(), Set.of(ARROZ));
        }
        long receitasAntes = contarReceitas(consultoria);
        long alimentosAntes = contar("select count(*) from alimento where consultoria_id = ?", consultoria);
        try (Connection conexao = dataSource.getConnection()) {
            V062__dietas_padrao.aplicar(conexao, consultoria);
        }
        assertThat(contarReceitas(consultoria)).isEqualTo(receitasAntes);
        assertThat(contar("select count(*) from alimento where consultoria_id = ?", consultoria)).isEqualTo(alimentosAntes);
        assertThat(kcalDe(consultoria, ARROZ)).isEqualByComparingTo("1");
    }

    private void apagarAsDietas(UUID consultoria) {
        for (String nome : DietasPadrao.modelos().stream().map(DietasPadrao.Modelo::nome).toList()) {
            jdbc.update("delete from receita where consultoria_id = ? and tipo = 'PLANO_DIETA' and nome = ?",
                    consultoria, nome);
        }
    }

    private void conferirDieta(UUID consultoria, String nome, Set<String> semConferirNumero) {
        String corpo = jdbc.queryForObject(
                "select conteudo from receita where consultoria_id = ? and tipo = 'PLANO_DIETA' and nome = ?",
                String.class, consultoria, nome);
        ConteudoDieta conteudo = json.readValue(corpo, ConteudoDieta.class);
        DietasPadrao.cadaItem(conteudo, item -> conferirItem(consultoria, item, semConferirNumero));
    }

    private void conferirItem(UUID consultoria, Item item, Set<String> semConferirNumero) {
        if (DietasPadrao.manual(item)) {
            assertThat(item.nome()).isIn(MANUAIS);
            assertThat(item.alimentoId()).isNull();
            assertThat(item.kcal()).isNull();
            assertThat(item.proteina()).isNull();
            assertThat(item.carboidrato()).isNull();
            assertThat(item.gordura()).isNull();
            return;
        }
        assertThat(item.alimentoId()).as(item.nome()).isNotNull();
        UUID id = jdbc.queryForObject("select id from alimento where consultoria_id = ? and nome = ?", UUID.class,
                consultoria, item.nome());
        assertThat(item.alimentoId()).isEqualTo(id);
        assertThat(contar("select count(*) from alimento where consultoria_id = ? and nome = ?", consultoria, item.nome()))
                .isEqualTo(1L);
        Map<String, Object> alimento = jdbc.queryForMap(
                "select base_quantidade, base_unidade, kcal, proteina, carboidrato, gordura, gramas_por_unidade, "
                        + "fator_correcao, fator_coccao, origem, tipo, marca from alimento where id = ?", id);
        conferirValoresDoItem(item, alimento);
        if (semConferirNumero.contains(item.nome())) {
            return;
        }
        if (WheyDoRotulo.NOME.equals(item.nome())) {
            assertThat(item.quantidade()).isEqualByComparingTo(WheyDoRotulo.BASE);
            assertThat(item.unidade()).isEqualTo("g");
            assertThat(alimento.get("tipo")).isEqualTo("SUPLEMENTO");
            assertThat(alimento.get("marca")).isNull();
            assertThat(alimento.get("origem")).isEqualTo("MANUAL");
            iguais((BigDecimal) alimento.get("base_quantidade"), WheyDoRotulo.BASE);
            iguais((BigDecimal) alimento.get("kcal"), WheyDoRotulo.KCAL);
            iguais((BigDecimal) alimento.get("proteina"), WheyDoRotulo.PROTEINA);
            iguais((BigDecimal) alimento.get("carboidrato"), WheyDoRotulo.CARBOIDRATO);
            iguais((BigDecimal) alimento.get("gordura"), WheyDoRotulo.GORDURA);
            return;
        }
        Map<String, Object> catalogo = jdbc.queryForMap(
                "select base_quantidade, base_unidade, kcal, proteina, carboidrato, gordura, gramas_por_unidade, "
                        + "fator_correcao, fator_coccao from catalogo_alimento where nome_busca = ?",
                Buscas.semAcento(item.nome()));
        assertThat(alimento.get("origem")).isEqualTo("CATALOGO");
        assertThat(alimento.get("base_unidade")).isEqualTo(catalogo.get("base_unidade"));
        for (String coluna : new String[] {"base_quantidade", "kcal", "proteina", "carboidrato", "gordura",
                "gramas_por_unidade", "fator_correcao", "fator_coccao"}) {
            iguais((BigDecimal) alimento.get(coluna), (BigDecimal) catalogo.get(coluna));
        }
        if (OVO.equals(item.nome())) {
            assertThat(item.unidade()).isEqualTo("un");
            assertThat(alimento.get("gramas_por_unidade")).isNull();
            assertThat(item.kcal()).isNull();
        }
        if (FRANGO.equals(item.nome())) {
            assertThat(catalogo.get("kcal")).isNotNull();
            assertThat(item.kcal()).isNotNull();
        }
    }

    /** A mesma conta gravada no item: o número vem da linha do alimento, não de uma estimativa. */
    private static void conferirValoresDoItem(Item item, Map<String, Object> alimento) {
        Nutrientes nutrientes = new Nutrientes(item.alimentoId(), (BigDecimal) alimento.get("base_quantidade"),
                (String) alimento.get("base_unidade"), (BigDecimal) alimento.get("kcal"),
                (BigDecimal) alimento.get("proteina"), (BigDecimal) alimento.get("carboidrato"),
                (BigDecimal) alimento.get("gordura"), (BigDecimal) alimento.get("gramas_por_unidade"));
        iguais(item.kcal(), DietasPadrao.valorNaQuantidade(nutrientes.kcal(), nutrientes, item));
        iguais(item.proteina(), DietasPadrao.valorNaQuantidade(nutrientes.proteina(), nutrientes, item));
        iguais(item.carboidrato(), DietasPadrao.valorNaQuantidade(nutrientes.carboidrato(), nutrientes, item));
        iguais(item.gordura(), DietasPadrao.valorNaQuantidade(nutrientes.gordura(), nutrientes, item));
    }

    private UUID consultoriaNova() throws Exception {
        JsonNode treinador = new ApiDeTeste(mvc, json).novoTreinador();
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class,
                UUID.fromString(treinador.path("usuario").path("id").asString()));
    }

    private long contarReceitas(UUID consultoria) {
        return contar("select count(*) from receita where consultoria_id = ?", consultoria);
    }

    private long contar(String sql, Object... args) {
        Long total = jdbc.queryForObject(sql, Long.class, args);
        return total == null ? 0 : total;
    }

    private BigDecimal kcalDe(UUID consultoria, String nome) {
        return jdbc.queryForObject("select kcal from alimento where consultoria_id = ? and nome = ?",
                BigDecimal.class, consultoria, nome);
    }

    private BigDecimal kcalDoCatalogo(String nome) {
        return jdbc.queryForObject("select kcal from catalogo_alimento where nome = ?", BigDecimal.class, nome);
    }

    private static void iguais(BigDecimal gravado, BigDecimal catalogo) {
        if (gravado == null || catalogo == null) {
            assertThat(gravado).isEqualTo(catalogo);
        } else {
            assertThat(gravado).isEqualByComparingTo(catalogo);
        }
    }
}
