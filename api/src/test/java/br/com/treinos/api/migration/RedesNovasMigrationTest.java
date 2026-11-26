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
 * V103: as novas redes (aluno: YouTube, Facebook, LinkedIn e Telegram; consultoria: Facebook, LinkedIn e Telegram) nascem nulas
 * para quem já existia e o limite de 200 caracteres do link vale. O banco novo é migrado até a V102 e só então recebe a V103.
 * Só dados fictícios.
 */
class RedesNovasMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-0000-0000-0000-000000000103");
    private static final UUID ANTIGO = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001c1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void v103AsNovasRedesNascemNulasEOLimiteDeDuzentosValeNaColuna() throws Exception {
        String banco = "v103_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("102").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V103', 'v103-" + banco + "')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ANTIGO + "', '" + CONSULTORIA + "', 'Aluno antigo fictício')");

                assertThat(flyway(banco).target("103").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(texto(c, "select concat_ws('|', rede_facebook, rede_linkedin, rede_telegram) from consultoria where id = '" + CONSULTORIA + "'")).isEmpty();
                assertThat(texto(c, "select concat_ws('|', youtube, facebook, linkedin, telegram) from aluno where id = '" + ANTIGO + "'")).isEmpty();

                String link = "https://www.facebook.com/" + "a".repeat(175); // 200 caracteres
                st.execute("update consultoria set rede_facebook = '" + link + "', rede_linkedin = '" + link + "', rede_telegram = '" + link
                        + "' where id = '" + CONSULTORIA + "'");
                st.execute("update aluno set youtube = '" + link + "', facebook = '" + link + "', linkedin = '" + link + "', telegram = '" + link
                        + "' where id = '" + ANTIGO + "'");
                assertThatThrownBy(() -> st.execute("update consultoria set rede_telegram = '" + link + "b' where id = '" + CONSULTORIA + "'"))
                        .hasMessageContaining("character varying(200)");
                assertThatThrownBy(() -> st.execute("update aluno set linkedin = '" + link + "b' where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("character varying(200)");
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
