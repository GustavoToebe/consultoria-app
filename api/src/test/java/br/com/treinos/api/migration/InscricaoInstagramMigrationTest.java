package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V102: o Instagram da inscrição nasce nulo para quem já existia e o limite de 30 caracteres (o do aluno) vale. O banco
 * novo é migrado até a V101 e só então recebe a V102. Só dados fictícios.
 */
class InscricaoInstagramMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-0000-0000-0000-000000000102");
    private static final UUID ANTIGA = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void v102OInstagramDaInscricaoNasceNuloEOLimiteDeTrintaValeNaColuna() throws Exception {
        String banco = "v102_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("101").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V102', 'v102-" + banco + "')");
                st.execute("insert into inscricao(id, consultoria_id, nome, whatsapp) values ('" + ANTIGA + "', '" + CONSULTORIA
                        + "', 'Inscrição antiga fictícia', '(11) 98765-4321')");

                assertThat(flyway(banco).target("102").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(texto(c, "select instagram from inscricao where id = '" + ANTIGA + "'")).isNull();
                st.execute("update inscricao set instagram = '" + "a".repeat(30) + "' where id = '" + ANTIGA + "'");
                assertThatThrownBy(() -> st.execute("update inscricao set instagram = '" + "a".repeat(31) + "' where id = '" + ANTIGA + "'"))
                        .hasMessageContaining("character varying(30)");
                st.execute("update inscricao set instagram = null where id = '" + ANTIGA + "'");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String texto(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getString(1);
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
