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
 * V085: o aluno que já existia fica com {@code exibicao_do_nome} nulo (vale o padrão, só o primeiro nome) e o CHECK aceita os quatro
 * valores e nulo, e recusa qualquer outro. Usa outro banco na mesma instância, migrado até a V084. Só dados fictícios.
 */
class ExibicaoDoNomeMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-0000-0000-0000-000000000085");
    private static final UUID ANTIGO = UUID.fromString("eeeeeeee-0000-0000-0000-0000000000a1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void quemJaExistiaFicaNuloEOCheckAceitaSoOsQuatroValores() throws Exception {
        String banco = "v085_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("84").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V085', 'v085-" + banco + "')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ANTIGO + "', '" + CONSULTORIA + "', 'Aluno antigo fictício')");

                assertThat(flyway(banco).target("85").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(texto(c, "select exibicao_do_nome from aluno where id = '" + ANTIGO + "'")).isNull();
                for (String valor : new String[] {"NOME", "NOME_COMPLETO", "APELIDO", "NOME_E_APELIDO"}) {
                    st.execute("update aluno set exibicao_do_nome = '" + valor + "' where id = '" + ANTIGO + "'");
                }
                st.execute("update aluno set exibicao_do_nome = null where id = '" + ANTIGO + "'");
                for (String fora : new String[] {"nome", "TUDO", "''"}) {
                    assertThatThrownBy(() -> st.execute("update aluno set exibicao_do_nome = '" + fora.replace("'", "") + "' where id = '" + ANTIGO + "'"))
                            .hasMessageContaining("ck_aluno_exibicao_do_nome");
                }
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
