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
 * V100: quem já existia fica com o acesso ativo (as duas colunas nulas) e o CHECK exige as duas juntas e só o motivo MANUAL.
 * V101: as redes nascem nulas e os limites de tamanho valem (200 na consultoria, 30 e 24 no aluno). Cada teste usa outro banco na
 * mesma instância, migrado até a migration anterior. Só dados fictícios.
 */
class AcessoERedesMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-0000-0000-0000-000000000100");
    private static final UUID ANTIGO = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001a1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void v100QuemJaExistiaTemAcessoAtivoEOCheckExigeAsDuasColunasJuntasESoManual() throws Exception {
        String banco = "v100_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("99").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                criar(st, banco);

                assertThat(flyway(banco).target("100").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(texto(c, "select acesso_desativado_em::text || coalesce(acesso_desativado_motivo, '') from aluno where id = '" + ANTIGO + "'")).isNull();
                st.execute("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = 'MANUAL' where id = '" + ANTIGO + "'");
                st.execute("update aluno set acesso_desativado_em = null, acesso_desativado_motivo = null where id = '" + ANTIGO + "'");
                // As duas juntas: uma só preenchida é recusada, nos dois sentidos.
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_em = now() where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_motivo = 'MANUAL' where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
                // Só o motivo conhecido.
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = 'ATRASO' where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = '' where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    @Test
    void v101AsRedesNascemNulasEOsLimitesDeTamanhoValem() throws Exception {
        String banco = "v101_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("100").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                criar(st, banco);

                assertThat(flyway(banco).target("101").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(texto(c, "select concat_ws('|', rede_instagram, rede_tiktok, rede_youtube, rede_x, rede_site) from consultoria where id = '" + CONSULTORIA + "'")).isEmpty();
                assertThat(texto(c, "select concat_ws('|', instagram, tiktok) from aluno where id = '" + ANTIGO + "'")).isEmpty();

                String link = "https://instagram.com/" + "a".repeat(178); // 200 caracteres
                st.execute("update consultoria set rede_instagram = '" + link + "', rede_site = '" + link + "' where id = '" + CONSULTORIA + "'");
                assertThatThrownBy(() -> st.execute("update consultoria set rede_x = '" + link + "b' where id = '" + CONSULTORIA + "'"))
                        .hasMessageContaining("character varying(200)");
                st.execute("update aluno set instagram = '" + "a".repeat(30) + "', tiktok = '" + "b".repeat(24) + "' where id = '" + ANTIGO + "'");
                assertThatThrownBy(() -> st.execute("update aluno set instagram = '" + "a".repeat(31) + "' where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("character varying(30)");
                assertThatThrownBy(() -> st.execute("update aluno set tiktok = '" + "b".repeat(25) + "' where id = '" + ANTIGO + "'"))
                        .hasMessageContaining("character varying(24)");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static void criar(Statement st, String banco) throws SQLException {
        st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V100', 'v100-" + banco + "')");
        st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ANTIGO + "', '" + CONSULTORIA + "', 'Aluno antigo fictício')");
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
