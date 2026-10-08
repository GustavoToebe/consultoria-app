package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Toda migration nova sobe o total e entra na lista (como a Central). */
class FlywayMigrationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void aplicouTodasAsMigrations() {
        Integer total = jdbcTemplate.queryForObject(
                "select count(*) from flyway_schema_history where type = 'SQL' and success = true", Integer.class);
        List<String> descricoes = jdbcTemplate.queryForList(
                "select description from flyway_schema_history where type = 'SQL' order by installed_rank",
                String.class);
        assertThat(total).isEqualTo(7);
        assertThat(descricoes).containsExactly("identidade", "alunos", "biblioteca", "planos", "execucoes",
                "catalogo publico", "catalogo taco");
    }

    @Test
    void catalogoDeAlimentosVemDaTaco() {
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where fonte like 'Valores de demonstração%'", Integer.class))
                .isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where fonte <> 'TACO 4ª ed. (2011), NEPA/UNICAMP'"
                        + " or kcal < 0 or proteina < 0 or carboidrato < 0 or gordura < 0"
                        + " or nome_busca is null or nome_busca = ''", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where nome_busca like '%ã%' or nome_busca <> lower(nome_busca)",
                Integer.class)).isZero();
        // Alimento sem análise (leite integral, 458 da TACO) não pode ter entrado com zeros.
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from catalogo_alimento where codigo_fonte in ('450', '457', '458', '472', '540', '591')",
                Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select tracos from catalogo_alimento where codigo_fonte = '9'", String.class)).isNull();
    }

    @Test
    void catalogoPublicoTemIdsFixos() {
        Integer exercicios = jdbcTemplate.queryForObject("select count(*) from catalogo_exercicio", Integer.class);
        Integer alimentos = jdbcTemplate.queryForObject("select count(*) from catalogo_alimento", Integer.class);
        assertThat(exercicios).isEqualTo(52);
        assertThat(alimentos).isEqualTo(591); // alimentos no relatório dados/relatorios/taco-importacao.md
        String id = jdbcTemplate.queryForObject("select id::text from catalogo_exercicio where nome = 'Prancha'",
                String.class);
        assertThat(id).isEqualTo(jdbcTemplate.queryForObject("select md5('catalogo-exercicio:Prancha')::uuid::text",
                String.class));
    }
}
