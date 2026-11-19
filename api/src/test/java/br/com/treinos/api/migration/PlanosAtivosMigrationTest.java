package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V091 sobre dados da V090: o plano comercial que já existia vira "inclui tudo" (as duas colunas nascem {@code true}, NOT NULL), o
 * CHECK {@code ck_plano_comercial_inclui_algo} barra os dois falsos e aceita um só ligado. Usa outro banco na mesma instância,
 * migrado até a V090. Só dados fictícios.
 */
class PlanosAtivosMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee91");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void planoAntigoViraIncluiTudoEOCheckBarraOsDoisFalsos() throws Exception {
        String banco = "v091_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("90").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V091', 'v091-"
                        + CONSULTORIA + "')");
                st.execute(plano("Plano antigo fictício", "", ""));

                assertThat(flyway(banco).target("91").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(contar(c, "select count(*) from plano_comercial where inclui_treino and inclui_dieta")).isEqualTo(1);
                assertThat(contar(c, "select count(*) from information_schema.columns where table_name = 'plano_comercial'"
                        + " and column_name in ('inclui_treino', 'inclui_dieta') and is_nullable = 'NO'"
                        + " and column_default = 'true'")).isEqualTo(2);
                // Plano novo sem as colunas também fica "inclui tudo".
                st.execute(plano("Plano novo fictício", "", ""));
                assertThat(contar(c, "select count(*) from plano_comercial where inclui_treino and inclui_dieta")).isEqualTo(2);

                // Um só ligado vale; os dois desligados, não.
                st.execute(plano("Só treino fictício", ", inclui_treino, inclui_dieta", ", true, false"));
                st.execute(plano("Só dieta fictício", ", inclui_treino, inclui_dieta", ", false, true"));
                assertThatThrownBy(() -> st.execute(plano("Nenhum fictício", ", inclui_treino, inclui_dieta", ", false, false")))
                        .hasMessageContaining("ck_plano_comercial_inclui_algo");
                assertThatThrownBy(() -> st.execute("update plano_comercial set inclui_treino = false, inclui_dieta = false"))
                        .hasMessageContaining("ck_plano_comercial_inclui_algo");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String plano(String nome, String colunas, String valores) {
        return "insert into plano_comercial(id, consultoria_id, nome, valor_centavos, periodicidade" + colunas
                + ") values (gen_random_uuid(), '" + CONSULTORIA + "', '" + nome + "', 10000, 'MENSAL'" + valores + ")";
    }

    private static int contar(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private FluentConfiguration flyway(String banco) {
        return Flyway.configure().dataSource(urlDe(banco), usuarioAdmin, senhaAdmin)
                .locations("classpath:db/migration").placeholders(Map.of("papelApp", ""));
    }

    private void admin(String banco, String comando) throws Exception {
        try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
            st.execute(comando);
        }
    }

    private String urlDe(String banco) {
        int barra = urlPadrao.indexOf('/', "jdbc:postgresql://".length());
        int interrogacao = urlPadrao.indexOf('?', barra);
        String resto = interrogacao < 0 ? "" : urlPadrao.substring(interrogacao);
        return urlPadrao.substring(0, barra + 1) + banco + resto;
    }
}
