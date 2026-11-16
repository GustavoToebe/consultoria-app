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

/**
 * V071 sobre comentários gravados antes da coluna {@code da_equipe}: o comentário de aulão de quem é TREINADOR vira da equipe, o de
 * aluno e todo comentário do mural (até a V071 só aluno comentava lá) ficam {@code false}. Usa outro banco na mesma instância,
 * migrado até a V070. Só dados fictícios.
 */
class ComunidadeDaEquipeMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("dddddddd-dddd-dddd-dddd-ddddddddddd1");
    private static final UUID TREINADOR = UUID.fromString("dddddddd-0000-0000-0000-00000000000a");
    private static final UUID ALUNO = UUID.fromString("dddddddd-0000-0000-0000-00000000000b");
    private static final UUID AULA = UUID.fromString("dddddddd-0000-0000-0000-0000000000a1");
    private static final UUID POST = UUID.fromString("dddddddd-0000-0000-0000-0000000000b1");
    private static final UUID DA_EQUIPE_NA_AULA = UUID.fromString("dddddddd-0000-0000-0000-0000000000c1");
    private static final UUID DO_ALUNO_NA_AULA = UUID.fromString("dddddddd-0000-0000-0000-0000000000c2");
    private static final UUID DO_ALUNO_NO_MURAL = UUID.fromString("dddddddd-0000-0000-0000-0000000000c3");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void comentarioAntigoDeTreinadorNaAulaViraDaEquipeEOsOutrosNao() throws Exception {
        String banco = "v071_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("70").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V071', 'v071-" + banco + "')");
                usuario(st, TREINADOR, "TREINADOR");
                usuario(st, ALUNO, "ALUNO");
                st.execute("insert into comunidade_aula(id, consultoria_id, titulo, video_url) values ('" + AULA + "', '" + CONSULTORIA
                        + "', 'Aulão fictício', 'https://exemplo.test/v')");
                st.execute("insert into comunidade_mural_post(id, consultoria_id, autor_id, autor_nome, texto) values ('" + POST + "', '"
                        + CONSULTORIA + "', '" + ALUNO + "', 'Aluno fictício', 'Post fictício')");
                comentarioDeAula(st, DA_EQUIPE_NA_AULA, TREINADOR);
                comentarioDeAula(st, DO_ALUNO_NA_AULA, ALUNO);
                st.execute("insert into comunidade_mural_comentario(id, consultoria_id, post_id, autor_id, autor_nome, texto) values ('"
                        + DO_ALUNO_NO_MURAL + "', '" + CONSULTORIA + "', '" + POST + "', '" + ALUNO + "', 'Aluno fictício', 'Oi')");

                assertThat(flyway(banco).target("71").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(daEquipe(c, "comunidade_aula_comentario", DA_EQUIPE_NA_AULA)).isTrue();
                assertThat(daEquipe(c, "comunidade_aula_comentario", DO_ALUNO_NA_AULA)).isFalse();
                assertThat(daEquipe(c, "comunidade_mural_comentario", DO_ALUNO_NO_MURAL)).isFalse();
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static void usuario(Statement st, UUID id, String papel) throws SQLException {
        st.execute("insert into usuario(id, consultoria_id, email, nome, senha_hash, papel) values ('" + id + "', '" + CONSULTORIA
                + "', '" + id + "@exemplo.test', 'Pessoa fictícia', 'x', '" + papel + "')");
    }

    private static void comentarioDeAula(Statement st, UUID id, UUID autor) throws SQLException {
        st.execute("insert into comunidade_aula_comentario(id, consultoria_id, aula_id, autor_id, autor_nome, texto) values ('" + id
                + "', '" + CONSULTORIA + "', '" + AULA + "', '" + autor + "', 'Pessoa fictícia', 'Oi')");
    }

    private static boolean daEquipe(Connection c, String tabela, UUID id) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select da_equipe from " + tabela + " where id = '" + id + "'")) {
            assertThat(rs.next()).isTrue();
            return rs.getBoolean(1);
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
