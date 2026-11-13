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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V072 sobre dados da V071: a reação que é exatamente o coração (U+2764 U+FE0F) vira {@code CURTIR}, tudo o mais some (inclusive
 * um {@code CURTIR} escrito à mão pela API antiga) e a UNIQUE continua valendo; o tipo {@code ENQUETE} anda junto com as colunas
 * da enquete; opção e voto ficam presos ao mesmo post; a capa tem no máximo um dono e a miniatura externa sai. Usa outro banco na
 * mesma instância, migrado até a V071. Só dados fictícios.
 */
class ComunidadeEnquetesMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1");
    private static final UUID USUARIO_A = UUID.fromString("eeeeeeee-0000-0000-0000-00000000000a");
    private static final UUID USUARIO_B = UUID.fromString("eeeeeeee-0000-0000-0000-00000000000b");
    private static final UUID POST = UUID.fromString("eeeeeeee-0000-0000-0000-0000000000a1");
    private static final String CORACAO = "chr(10084) || chr(65039)";

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void reacoesViramCodigosEAsRegrasDaEnqueteEDaCapaValem() throws Exception {
        String banco = "v072_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("71").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                prepararDadosDaV071(st, banco);

                assertThat(flyway(banco).target("72").load().migrate().migrationsExecuted).isEqualTo(1);

                // Só o coração virou CURTIR (dois usuários, o mesmo post); fogo e o CURTIR escrito à mão saíram.
                assertThat(codigos(c)).containsExactlyInAnyOrder("CURTIR", "CURTIR");
                assertThatThrownBy(() -> st.execute(reacao(POST, USUARIO_A, "codigo", "'INEXISTENTE'")))
                        .hasMessageContaining("ck_comunidade_mural_reacao_codigo");
                assertThatThrownBy(() -> st.execute(reacao(POST, USUARIO_A, "codigo", "'CURTIR'")))
                        .hasMessageContaining("uk_mural_reacao_usuario");

                verificarEnquete(c, st);
                verificarCapa(st);
                assertThat(colunaExiste(c, "comunidade_aula", "miniatura_url")).isFalse();
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private void prepararDadosDaV071(Statement st, String banco) throws SQLException {
        st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V072', 'v072-" + banco + "')");
        for (UUID u : List.of(USUARIO_A, USUARIO_B)) {
            st.execute("insert into usuario(id, consultoria_id, email, nome, senha_hash, papel) values ('" + u + "', '" + CONSULTORIA
                    + "', '" + u + "@exemplo.test', 'Aluno fictício', 'x', 'ALUNO')");
        }
        st.execute("insert into comunidade_mural_post(id, consultoria_id, autor_id, autor_nome, texto) values ('" + POST + "', '"
                + CONSULTORIA + "', '" + USUARIO_A + "', 'Aluno fictício', 'Post fictício')");
        st.execute(reacao(POST, USUARIO_A, "emoji", CORACAO));
        st.execute(reacao(POST, USUARIO_B, "emoji", CORACAO));
        // Fogo (chr(128293)) e um CURTIR escrito à mão não entram na lista nova.
        st.execute(reacao(POST, USUARIO_A, "emoji", "chr(128293)"));
        st.execute(reacao(POST, USUARIO_B, "emoji", "'CURTIR'"));
    }

    private static String reacao(UUID post, UUID usuario, String coluna, String valorSql) {
        return "insert into comunidade_mural_reacao(consultoria_id, post_id, usuario_id, " + coluna + ") values ('"
                + CONSULTORIA + "', '" + post + "', '" + usuario + "', " + valorSql + ")";
    }

    private void verificarEnquete(Connection c, Statement st) throws SQLException {
        // Enquete exige as duas colunas juntas: o tipo sem o campo, e o campo sem o tipo, são recusados.
        UUID enquete = UUID.randomUUID();
        assertThatThrownBy(() -> st.execute(post(enquete, "ENQUETE", "null")))
                .hasMessageContaining("ck_comunidade_mural_post_enquete");
        assertThatThrownBy(() -> st.execute(post(UUID.randomUUID(), "CONVERSA", "false")))
                .hasMessageContaining("ck_comunidade_mural_post_enquete");
        st.execute(post(enquete, "ENQUETE", "false"));
        UUID outraEnquete = UUID.randomUUID();
        st.execute(post(outraEnquete, "ENQUETE", "true"));
        // O prazo só existe na enquete.
        assertThatThrownBy(() -> st.execute("update comunidade_mural_post set enquete_encerra_em = now() where id = '" + POST + "'"))
                .hasMessageContaining("ck_comunidade_mural_post");

        UUID opcao = UUID.randomUUID();
        UUID deOutroPost = UUID.randomUUID();
        st.execute(opcao(opcao, enquete, 0, "'Sim'"));
        st.execute(opcao(deOutroPost, outraEnquete, 0, "'Não'"));
        assertThatThrownBy(() -> st.execute(opcao(UUID.randomUUID(), enquete, 0, "'Repetida na ordem'")))
                .hasMessageContaining("uk_comunidade_enquete_opcao_ordem");
        assertThatThrownBy(() -> st.execute(opcao(UUID.randomUUID(), enquete, 6, "'Fora da faixa'")))
                .hasMessageContaining("ck_comunidade_enquete_opcao_ordem");
        assertThatThrownBy(() -> st.execute(opcao(UUID.randomUUID(), enquete, 1, "''")))
                .hasMessageContaining("ck_comunidade_enquete_opcao_texto");

        st.execute(voto(enquete, opcao, USUARIO_A));
        assertThatThrownBy(() -> st.execute(voto(enquete, opcao, USUARIO_A))).hasMessageContaining("uk_comunidade_enquete_voto");
        // A opção de outro post não casa com a FK composta (consultoria, post, opção).
        assertThatThrownBy(() -> st.execute(voto(enquete, deOutroPost, USUARIO_B)))
                .hasMessageContaining("fk_comunidade_enquete_voto_opcao");
        // Apagar o post leva opções e votos por cascata.
        st.execute("delete from comunidade_mural_post where id = '" + enquete + "'");
        assertThat(contar(c, "select count(*) from comunidade_enquete_opcao where post_id = '" + enquete + "'")).isZero();
        assertThat(contar(c, "select count(*) from comunidade_enquete_voto where post_id = '" + enquete + "'")).isZero();
    }

    private void verificarCapa(Statement st) throws SQLException {
        UUID aula = UUID.randomUUID();
        st.execute("insert into comunidade_aula(id, consultoria_id, titulo, video_url) values ('" + aula + "', '" + CONSULTORIA
                + "', 'Aulão fictício', 'https://exemplo.test/v')");
        // Pendente (sem dono) pode ser várias; com dono, uma por aula; os dois donos juntos não.
        st.execute(capa("null", "null"));
        st.execute(capa("null", "null"));
        st.execute(capa("'" + aula + "'", "null"));
        assertThatThrownBy(() -> st.execute(capa("'" + aula + "'", "null"))).hasMessageContaining("uk_comunidade_capa_aula");
        assertThatThrownBy(() -> st.execute(capa("'" + aula + "'", "'" + POST + "'"))).hasMessageContaining("ck_comunidade_capa_um_dono");
    }

    private static String post(UUID id, String tipo, String varias) {
        return "insert into comunidade_mural_post(id, consultoria_id, autor_id, autor_nome, texto, tipo, enquete_varias_respostas) values ('"
                + id + "', '" + CONSULTORIA + "', '" + USUARIO_A + "', 'Aluno fictício', 'Pergunta fictícia', '" + tipo + "', " + varias + ")";
    }

    private static String opcao(UUID id, UUID post, int ordem, String textoSql) {
        return "insert into comunidade_enquete_opcao(id, consultoria_id, post_id, ordem, texto) values ('" + id + "', '" + CONSULTORIA
                + "', '" + post + "', " + ordem + ", " + textoSql + ")";
    }

    private static String voto(UUID post, UUID opcao, UUID usuario) {
        return "insert into comunidade_enquete_voto(consultoria_id, post_id, opcao_id, usuario_id) values ('" + CONSULTORIA + "', '"
                + post + "', '" + opcao + "', '" + usuario + "')";
    }

    private static String capa(String aulaSql, String postSql) {
        return "insert into comunidade_capa(consultoria_id, bytes, tamanho, aula_id, post_id) values ('" + CONSULTORIA
                + "', '\\x01'::bytea, 1, " + aulaSql + ", " + postSql + ")";
    }

    private static List<String> codigos(Connection c) throws SQLException {
        List<String> r = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "select codigo from comunidade_mural_reacao where consultoria_id = '" + CONSULTORIA + "'")) {
            while (rs.next()) {
                r.add(rs.getString(1));
            }
        }
        return r;
    }

    private static int contar(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private static boolean colunaExiste(Connection c, String tabela, String coluna) throws SQLException {
        return contar(c, "select count(*) from information_schema.columns where table_name = '" + tabela + "' and column_name = '"
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
