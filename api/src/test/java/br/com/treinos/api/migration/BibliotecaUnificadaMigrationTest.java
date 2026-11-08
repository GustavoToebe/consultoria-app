package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A suíte sobe já na V061, com a tabela {@code suplemento} apagada. Este teste usa outro banco na mesma instância:
 * migra até a V060, grava suplementos e só então aplica a V061.
 */
class BibliotecaUnificadaMigrationTest extends AbstractIntegrationTest {

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void copiaSuplementoParaAlimentoERemoveATabela() throws Exception {
        String banco = "v061_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        UUID consultoria = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
        UUID suplemento = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
        UUID alimento = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("60").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin)) {
                try (PreparedStatement ps = c.prepareStatement(
                        "insert into consultoria(id, nome, slug) values (?, 'Consultoria fictícia V061', ?)")) {
                    ps.setObject(1, consultoria);
                    ps.setString(2, "v061-" + banco);
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = c.prepareStatement("""
                        insert into suplemento(id, consultoria_id, nome, nome_busca, marca, categoria, porcao,
                            porcoes_por_embalagem, sabores, link, cupom, ativo, versao)
                        values (?, ?, 'Whey de teste', 'whey de teste', 'Marca Fictícia', 'Proteína',
                            '30 g (2 dosadores)', 'cerca de 33', ?::jsonb, 'https://exemplo.test/whey', 'TESTE10', true, 3)
                        """)) {
                    ps.setObject(1, suplemento);
                    ps.setObject(2, consultoria);
                    ps.setString(3, "[\"Maracujá\",\"Morango\"]");
                    ps.executeUpdate();
                }
                try (PreparedStatement ps = c.prepareStatement(
                        "insert into alimento(id, consultoria_id, nome, kcal) values (?, ?, 'Arroz fictício', 128)")) {
                    ps.setObject(1, alimento);
                    ps.setObject(2, consultoria);
                    ps.executeUpdate();
                }
            }
            assertThat(flyway(banco).target("61").load().migrate().migrationsExecuted).isEqualTo(1);
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin)) {
                assertThat(escalar(c, "select to_regclass('public.suplemento')")).isNull();
                try (PreparedStatement ps = c.prepareStatement("""
                        select tipo, marca, link, cupom, sabores::text, grupo, nome_busca, porcao, porcoes_por_embalagem,
                               kcal is null, base_quantidade, base_unidade, origem, ativo, versao, consultoria_id
                        from alimento where id = ?
                        """)) {
                    ps.setObject(1, suplemento);
                    try (ResultSet rs = ps.executeQuery()) {
                        assertThat(rs.next()).isTrue();
                        assertThat(rs.getString(1)).isEqualTo("SUPLEMENTO");
                        assertThat(rs.getString(2)).isEqualTo("Marca Fictícia");
                        assertThat(rs.getString(3)).isEqualTo("https://exemplo.test/whey");
                        assertThat(rs.getString(4)).isEqualTo("TESTE10");
                        assertThat(rs.getString(5)).contains("Maracujá").contains("Morango");
                        assertThat(rs.getString(6)).isEqualTo("Proteína");
                        assertThat(rs.getString(7)).isEqualTo("whey de teste");
                        assertThat(rs.getString(8)).isEqualTo("30 g (2 dosadores)");
                        assertThat(rs.getString(9)).isEqualTo("cerca de 33");
                        assertThat(rs.getBoolean(10)).isTrue();
                        assertThat(rs.getBigDecimal(11)).isEqualByComparingTo("100");
                        assertThat(rs.getString(12)).isEqualTo("g");
                        assertThat(rs.getString(13)).isEqualTo("MANUAL");
                        assertThat(rs.getBoolean(14)).isTrue();
                        assertThat(rs.getLong(15)).isEqualTo(3);
                        assertThat(rs.getObject(16, UUID.class)).isEqualTo(consultoria);
                        assertThat(rs.next()).isFalse();
                    }
                }
                UUID outra = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4");
                try (PreparedStatement ps = c.prepareStatement(
                        "insert into consultoria(id, nome, slug) values (?, 'Outra consultoria fictícia V061', ?)")) {
                    ps.setObject(1, outra);
                    ps.setString(2, "v061b-" + banco);
                    ps.executeUpdate();
                }
                inserir(c, "insert into alimento(id, consultoria_id, nome, tipo, kcal) values (?, ?, 'Creatina', 'ALIMENTO', 1)",
                        UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5"), consultoria);
                inserir(c, """
                        insert into alimento(id, consultoria_id, nome, tipo, nome_busca, kcal)
                        values (?, ?, 'Creatina', 'SUPLEMENTO', 'creatina', null)
                        """, UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6"), consultoria);
                inserir(c, """
                        insert into alimento(id, consultoria_id, nome, tipo, nome_busca, kcal)
                        values (?, ?, 'Creatina', 'SUPLEMENTO', 'creatina', null)
                        """, UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7"), outra);
                inserir(c, """
                        insert into alimento(id, consultoria_id, nome, tipo, nome_busca, kcal, ativo)
                        values (?, ?, 'Creatina', 'SUPLEMENTO', 'creatina', null, false)
                        """, UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8"), consultoria);
                assertThat(escalar(c, """
                        select string_agg(tipo, ',' order by tipo) from alimento
                        where consultoria_id = '%s'::uuid and lower(nome) = 'creatina' and ativo
                        """.formatted(consultoria))).isEqualTo("ALIMENTO,SUPLEMENTO");
                assertThat(escalar(c, """
                        select count(*)::text from alimento where consultoria_id = '%s'::uuid and nome_busca = 'creatina' and tipo = 'SUPLEMENTO'
                        """.formatted(outra))).isEqualTo("1");
                assertThat(escalar(c, """
                        select count(*)::text from alimento
                        where consultoria_id = '%s'::uuid and nome_busca = 'creatina' and tipo = 'SUPLEMENTO' and not ativo
                        """.formatted(consultoria))).isEqualTo("1");
                assertThatThrownBy(() -> inserir(c,
                        "insert into alimento(id, consultoria_id, nome, tipo, kcal) values (?, ?, 'Sem kcal fictício', 'ALIMENTO', null)",
                        UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9"), consultoria))
                        .isInstanceOf(SQLException.class)
                        .hasMessageContaining("alimento_kcal_obrigatoria_check");
                try (PreparedStatement ps = c.prepareStatement(
                        "select tipo, kcal from alimento where id = ?")) {
                    ps.setObject(1, alimento);
                    try (ResultSet rs = ps.executeQuery()) {
                        assertThat(rs.next()).isTrue();
                        assertThat(rs.getString(1)).isEqualTo("ALIMENTO");
                        assertThat(rs.getBigDecimal(2)).isEqualByComparingTo("128");
                    }
                }
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
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

    private static void inserir(Connection c, String sql, UUID id, UUID consultoria) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setObject(1, id);
            ps.setObject(2, consultoria);
            ps.executeUpdate();
        }
    }

    private static String escalar(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            assertThat(rs.next()).isTrue();
            return rs.getString(1);
        }
    }
}
