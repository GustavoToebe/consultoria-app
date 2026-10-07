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
        assertThat(total).isEqualTo(6);
        assertThat(descricoes).containsExactly("identidade", "alunos", "biblioteca", "planos", "execucoes",
                "catalogo publico");
    }

    @Test
    void catalogoPublicoTemIdsFixos() {
        Integer exercicios = jdbcTemplate.queryForObject("select count(*) from catalogo_exercicio", Integer.class);
        Integer alimentos = jdbcTemplate.queryForObject("select count(*) from catalogo_alimento", Integer.class);
        assertThat(exercicios).isEqualTo(52);
        assertThat(alimentos).isEqualTo(9);
        String id = jdbcTemplate.queryForObject("select id::text from catalogo_exercicio where nome = 'Prancha'",
                String.class);
        assertThat(id).isEqualTo(jdbcTemplate.queryForObject("select md5('catalogo-exercicio:Prancha')::uuid::text",
                String.class));
    }
}
