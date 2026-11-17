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
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V083 e V084 sobre dados da V082: a consultoria com tema {@code CAFE} passa a {@code ESCURO} (e as outras paletas ficam),
 * o CHECK deixa de aceitar {@code CAFE}; o compromisso que já existia ganha {@code [30]} nos lembretes e o CHECK recusa mais de
 * 5 itens, fora de 1 a 40320 e nulo, e aceita a lista vazia. Usa outro banco na mesma instância, migrado até a V082. Só dados
 * fictícios.
 */
class TemaCafeELembretesMigrationTest extends AbstractIntegrationTest {

    private static final UUID COM_CAFE = UUID.fromString("cafe0000-0000-0000-0000-000000000001");
    private static final UUID COM_OCEANO = UUID.fromString("cafe0000-0000-0000-0000-000000000002");
    private static final UUID COMPROMISSO = UUID.fromString("cafe0000-0000-0000-0000-0000000000c1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void cafeViraEscuroELembretesNascemComTrintaMinutos() throws Exception {
        String banco = "v083_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("82").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                consultoria(st, COM_CAFE, "CAFE", banco);
                consultoria(st, COM_OCEANO, "OCEANO", banco);
                st.execute("insert into compromisso(id, consultoria_id, inicio, duracao_minutos, fim) values ('" + COMPROMISSO + "', '"
                        + COM_CAFE + "', '2030-01-01T10:00:00Z', 30, '2030-01-01T10:30:00Z')");

                assertThat(flyway(banco).target("84").load().migrate().migrationsExecuted).isEqualTo(2);

                assertThat(texto(c, "select tema_padrao from consultoria where id = '" + COM_CAFE + "'")).isEqualTo("ESCURO");
                assertThat(texto(c, "select tema_padrao from consultoria where id = '" + COM_OCEANO + "'")).isEqualTo("OCEANO");
                assertThatThrownBy(() -> st.execute("update consultoria set tema_padrao = 'CAFE' where id = '" + COM_OCEANO + "'"))
                        .hasMessageContaining("consultoria_tema_padrao_check");

                assertThat(texto(c, "select lembretes_minutos::text from compromisso where id = '" + COMPROMISSO + "'")).isEqualTo("{30}");
                st.execute(lembretes("'{}'"));
                st.execute(lembretes("'{1,5,60,1440,40320}'"));
                for (String fora : new String[] {"'{1,2,3,4,5,6}'", "'{0}'", "'{40321}'", "'{30,NULL}'"}) {
                    assertThatThrownBy(() -> st.execute(lembretes(fora))).hasMessageContaining("ck_compromisso_lembretes");
                }
                assertThatThrownBy(() -> st.execute(lembretes("NULL"))).hasMessageContaining("lembretes_minutos");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static void consultoria(Statement st, UUID id, String tema, String banco) throws SQLException {
        st.execute("insert into consultoria(id, nome, slug, tema_padrao) values ('" + id + "', 'Consultoria fictícia V083', 'v083-"
                + tema.toLowerCase(Locale.ROOT) + "-" + banco + "', '" + tema + "')");
    }

    private static String lembretes(String valorSql) {
        return "update compromisso set lembretes_minutos = " + valorSql + "::integer[] where id = '" + COMPROMISSO + "'";
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
