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
 * V070: quem já existia fica com {@code perfil_reservado = false} (a regra da idade só vale para quem entra depois) e o aluno
 * criado depois da migration nasce com nulo, sem default. Também confere a data de nascimento mínima e o destino novo da
 * anamnese. Usa outro banco na mesma instância, migrado até a V069. Só dados fictícios.
 */
class PerfilDaComunidadeMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("dddddddd-dddd-dddd-dddd-ddddddddddd1");
    private static final UUID ANTIGO = UUID.fromString("dddddddd-0000-0000-0000-000000000001");
    private static final UUID ANONIMIZADO = UUID.fromString("dddddddd-0000-0000-0000-000000000002");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void quemJaExistiaFicaComFalsoENovoAlunoNasceNulo() throws Exception {
        String banco = "v070_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("69").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V070', 'v070-" + banco + "')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ANTIGO + "', '" + CONSULTORIA + "', 'Aluno antigo fictício')");
                st.execute("insert into aluno(id, consultoria_id, nome, anonimizado_em) values ('" + ANONIMIZADO + "', '" + CONSULTORIA
                        + "', 'Aluno anonimizado fictício', now())");

                assertThat(flyway(banco).target("70").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(reservado(c, ANTIGO)).isEqualTo("false");
                // Anonimizado não guarda preferência nenhuma.
                assertThat(reservado(c, ANONIMIZADO)).isNull();

                UUID novo = UUID.randomUUID();
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + novo + "', '" + CONSULTORIA + "', 'Aluno novo fictício')");
                assertThat(reservado(c, novo)).isNull();

                assertThatThrownBy(() -> st.execute("update aluno set data_nascimento = date '1899-12-31' where id = '" + novo + "'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("ck_aluno_data_nascimento");
                st.execute("update aluno set data_nascimento = date '1900-01-01' where id = '" + novo + "'");

                // O destino novo da anamnese vale; um que não existe continua recusado pelo CHECK.
                assertThat(destinosPermitidos(c)).contains("DATA_NASCIMENTO");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String reservado(Connection c, UUID aluno) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "select perfil_reservado::text from aluno where id = '" + aluno + "'")) {
            rs.next();
            return rs.getString(1);
        }
    }

    private static String destinosPermitidos(Connection c) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "select pg_get_constraintdef(oid) from pg_constraint where conname = 'ck_anamnese_pendencia_destino'")) {
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
