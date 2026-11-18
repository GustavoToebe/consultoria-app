package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V089 (fibra do alimento): a suíte já sobe na V089, então este teste usa outro banco na mesma instância, migra até a
 * V088, grava alimentos da biblioteca vindos do catálogo e só então aplica a V089. Plano {@code fibra-do-alimento}.
 */
class FibraDoAlimentoMigrationTest extends AbstractIntegrationTest {

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void catalogoGanhaAFibraDaTacoEABibliotecaSoPreencheComCorrespondenciaUnicaSemSobrescrever() throws Exception {
        String banco = "v089_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        UUID a = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1");
        UUID b = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2");
        // Nome do alimento nº 1 da TACO (Arroz, integral, cozido: fibra 2,75), com caixa e espaços diferentes.
        UUID doCatalogoComEspacos = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01");
        UUID doCatalogoExato = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02");
        UUID manual = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03");
        UUID semCorrespondente = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04");
        UUID semFibraNoCatalogo = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05");
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("88").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin)) {
                consultoria(c, a, "v089a-" + banco);
                consultoria(c, b, "v089b-" + banco);
                alimento(c, doCatalogoComEspacos, a, "  ARROZ, integral, COZIDO ", "CATALOGO");
                alimento(c, doCatalogoExato, b, "Arroz, integral, cozido", "CATALOGO");
                alimento(c, manual, b, "Feijão, preto, cozido", "MANUAL");
                alimento(c, semCorrespondente, a, "Alimento fictício sem catálogo", "CATALOGO");
                alimento(c, semFibraNoCatalogo, a, "Bacalhau, salgado, refogado", "CATALOGO");
            }
            assertThat(flyway(banco).target("89").load().migrate().migrationsExecuted).isEqualTo(1);
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin)) {
                // Catálogo: fibra da TACO; Tr e NA viram 0 e o Tr entra em `tracos` depois dos macros; sem análise fica nula.
                assertThat(escalar(c, "select fibra::text from catalogo_alimento where codigo_fonte = '1' and fonte like 'TACO%'"))
                        .isEqualTo("2.75");
                assertThat(escalar(c, "select fibra::text || '|' || tracos from catalogo_alimento where codigo_fonte = '215'"))
                        .isEqualTo("0.00|fibra");
                assertThat(escalar(c, "select fibra::text || '|' || tracos from catalogo_alimento where codigo_fonte = '209'"))
                        .isEqualTo("0.00|gordura,fibra");
                assertThat(escalar(c, "select count(*)::text from catalogo_alimento where codigo_fonte = '280' and fibra is null"))
                        .isEqualTo("1");
                // 591 da TACO menos 12 sem análise de fibra (o `*` ou o campo vazio da planilha); Batel Grill não traz fibra.
                assertThat(escalar(c, "select count(*)::text from catalogo_alimento where fibra is not null")).isEqualTo("579");
                assertThat(escalar(c, "select count(*)::text from catalogo_alimento where fonte like 'TACO%' and fibra is null"))
                        .isEqualTo("12");
                assertThat(escalar(c, "select count(*)::text from catalogo_alimento where fonte not like 'TACO%' and fibra is not null"))
                        .isEqualTo("0");

                // Biblioteca: só a que veio do catálogo e tem correspondência única por nome (sem caixa nem espaços nas pontas).
                assertThat(fibraDe(c, doCatalogoComEspacos)).isEqualTo("2.75");
                assertThat(fibraDe(c, doCatalogoExato)).isEqualTo("2.75");
                assertThat(fibraDe(c, manual)).isNull();
                assertThat(fibraDe(c, semCorrespondente)).isNull();
                assertThat(fibraDe(c, semFibraNoCatalogo)).isNull();

                // Nunca sobrescreve: repete só a parte da biblioteca (o mesmo SQL da migration) com o valor do treinador já gravado.
                String preenchimento = preenchimentoDaBiblioteca();
                execute(c, "update alimento set fibra = 9.99 where id = '" + doCatalogoExato + "'");
                execute(c, "update alimento set fibra = null where id = '" + doCatalogoComEspacos + "'");
                execute(c, preenchimento);
                assertThat(fibraDe(c, doCatalogoExato)).isEqualTo("9.99");
                assertThat(fibraDe(c, doCatalogoComEspacos)).isEqualTo("2.75");

                // Nome com duas correspondências no catálogo não casa com nenhuma.
                execute(c, "update alimento set fibra = null where id = '" + doCatalogoComEspacos + "'");
                execute(c, """
                        insert into catalogo_alimento(id, nome, base_quantidade, base_unidade, kcal, fonte, nome_busca, fibra)
                        values (gen_random_uuid(), 'arroz, integral, cozido', 100, 'g', 1, 'Fonte fictícia', 'arroz, integral, cozido', 1.00)
                        """);
                execute(c, preenchimento);
                assertThat(fibraDe(c, doCatalogoComEspacos)).isNull();
                assertThat(fibraDe(c, doCatalogoExato)).isEqualTo("9.99");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    /** O trecho da migration que preenche a biblioteca (o último comando do arquivo gerado). */
    private static String preenchimentoDaBiblioteca() throws Exception {
        String sql = new ClassPathResource("db/migration/V089__fibra_do_alimento.sql")
                .getContentAsString(StandardCharsets.UTF_8);
        int inicio = sql.indexOf("update alimento as a");
        assertThat(inicio).isPositive();
        return sql.substring(inicio);
    }

    private static void consultoria(Connection c, UUID id, String slug) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "insert into consultoria(id, nome, slug) values (?, 'Consultoria fictícia V089', ?)")) {
            ps.setObject(1, id);
            ps.setString(2, slug);
            ps.executeUpdate();
        }
    }

    private static void alimento(Connection c, UUID id, UUID consultoria, String nome, String origem) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(
                "insert into alimento(id, consultoria_id, nome, kcal, origem) values (?, ?, ?, 100, ?)")) {
            ps.setObject(1, id);
            ps.setObject(2, consultoria);
            ps.setString(3, nome);
            ps.setString(4, origem);
            ps.executeUpdate();
        }
    }

    private static String fibraDe(Connection c, UUID id) throws Exception {
        return escalar(c, "select fibra::text from alimento where id = '" + id + "'");
    }

    private static void execute(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement()) {
            st.execute(sql);
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

    private static String escalar(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            assertThat(rs.next()).isTrue();
            return rs.getString(1);
        }
    }
}
