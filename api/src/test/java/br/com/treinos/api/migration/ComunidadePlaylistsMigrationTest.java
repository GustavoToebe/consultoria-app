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
 * V088 sobre dados da V087: a coluna {@code categoria} some e o aulão antigo fica sem playlist; a FK composta
 * {@code (consultoria_id, playlist_id)} barra playlist de outra consultoria; apagar a playlist zera só {@code playlist_id} (nunca
 * {@code consultoria_id}) e não apaga o aulão; o nome é único por consultoria sem diferença de maiúsculas; o índice de ordem cobre a
 * playlist. Usa outro banco na mesma instância, migrado até a V087. Só dados fictícios.
 */
class ComunidadePlaylistsMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA_A = UUID.fromString("dddddddd-dddd-dddd-dddd-ddddddddddd1");
    private static final UUID CONSULTORIA_B = UUID.fromString("dddddddd-dddd-dddd-dddd-ddddddddddd2");
    private static final UUID AULA_ANTIGA = UUID.fromString("dddddddd-0000-0000-0000-0000000000a1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void playlistSubstituiACategoriaEAFkCompostaIsolaPorConsultoria() throws Exception {
        String banco = "v088_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("87").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID consultoria : new UUID[] {CONSULTORIA_A, CONSULTORIA_B}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + consultoria + "', 'Consultoria fictícia V088', 'v088-"
                            + consultoria + "')");
                }
                st.execute("insert into comunidade_aula(id, consultoria_id, titulo, video_url, categoria) values ('" + AULA_ANTIGA + "', '"
                        + CONSULTORIA_A + "', 'Aulão fictício', 'https://exemplo.test/v', 'Mobilidade')");
                assertThat(colunaExiste(c, "categoria")).isTrue();

                assertThat(flyway(banco).target("88").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(colunaExiste(c, "categoria")).isFalse();
                assertThat(colunaExiste(c, "playlist_id")).isTrue();
                // O aulão antigo fica sem playlist (sem migração de texto) e continua da consultoria dele.
                assertThat(contar(c, "select count(*) from comunidade_aula where id = '" + AULA_ANTIGA + "' and playlist_id is null and consultoria_id = '"
                        + CONSULTORIA_A + "'")).isEqualTo(1);
                assertThat(textoDe(c, "select indexdef from pg_indexes where indexname = 'idx_comunidade_aula_consultoria_ordem'"))
                        .contains("playlist_id");

                UUID deA = playlist(st, CONSULTORIA_A, "Mobilidade");
                UUID deB = playlist(st, CONSULTORIA_B, "Mobilidade");
                // Nome único por consultoria sem diferença de maiúsculas; a outra consultoria pode repetir; nome vazio ou longo, não.
                assertThatThrownBy(() -> playlist(st, CONSULTORIA_A, "MOBILIDADE")).hasMessageContaining("ux_comunidade_playlist_nome");
                assertThatThrownBy(() -> playlist(st, CONSULTORIA_A, "")).hasMessageContaining("ck_comunidade_playlist_nome");
                assertThatThrownBy(() -> playlist(st, CONSULTORIA_A, "x".repeat(61))).hasMessageContaining("value too long");

                // A FK composta barra o aulão de A numa playlist de B (a FK simples deixaria passar).
                assertThatThrownBy(() -> st.execute("update comunidade_aula set playlist_id = '" + deB + "' where id = '" + AULA_ANTIGA + "'"))
                        .hasMessageContaining("fk_comunidade_aula_playlist");
                st.execute("update comunidade_aula set playlist_id = '" + deA + "' where id = '" + AULA_ANTIGA + "'");

                // Apagar a playlist zera só playlist_id: a consultoria (NOT NULL) fica e o aulão não é apagado.
                st.execute("delete from comunidade_playlist where id = '" + deA + "'");
                assertThat(contar(c, "select count(*) from comunidade_aula where id = '" + AULA_ANTIGA + "' and playlist_id is null and consultoria_id = '"
                        + CONSULTORIA_A + "'")).isEqualTo(1);
                assertThat(contar(c, "select count(*) from comunidade_playlist where id = '" + deB + "'")).isEqualTo(1);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static UUID playlist(Statement st, UUID consultoria, String nome) throws Exception {
        UUID id = UUID.randomUUID();
        st.execute("insert into comunidade_playlist(id, consultoria_id, nome) values ('" + id + "', '" + consultoria + "', '" + nome + "')");
        return id;
    }

    private static int contar(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private static String textoDe(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getString(1);
        }
    }

    private static boolean colunaExiste(Connection c, String coluna) throws Exception {
        return contar(c, "select count(*) from information_schema.columns where table_name = 'comunidade_aula' and column_name = '"
                + coluna + "'") > 0;
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
