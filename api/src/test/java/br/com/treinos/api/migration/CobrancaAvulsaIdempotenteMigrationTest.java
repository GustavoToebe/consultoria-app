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
 * V090 sobre dados da V089: {@code pedido_id} e {@code parcela} nascem nulas (a avulsa antiga segue como está), o CHECK os mantém
 * juntos e só na AVULSA com parcela de 1 a 12, o índice único parcial {@code (consultoria_id, pedido_id, aluno_id, parcela)} barra
 * a repetição na mesma consultoria, deixa o mesmo pedido e o mesmo aluno-parcela em outra consultoria e não vale para linhas sem
 * pedido (duas coexistem). Usa outro banco na mesma instância, migrado até a V089. Só dados fictícios.
 */
class CobrancaAvulsaIdempotenteMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA_A = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1");
    private static final UUID CONSULTORIA_B = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2");
    private static final UUID ALUNO_A = UUID.fromString("eeeeeeee-0000-0000-0000-0000000000a1");
    private static final UUID ALUNO_B = UUID.fromString("eeeeeeee-0000-0000-0000-0000000000b1");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void pedidoEParcelaSaoNulosEOIndiceUnicoParcialIsolaPorConsultoria() throws Exception {
        String banco = "v090_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("89").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID[] par : new UUID[][] {{CONSULTORIA_A, ALUNO_A}, {CONSULTORIA_B, ALUNO_B}}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + par[0] + "', 'Consultoria fictícia V090', 'v090-"
                            + par[0] + "')");
                    st.execute("insert into aluno(id, consultoria_id, nome) values ('" + par[1] + "', '" + par[0] + "', 'Aluno fictício')");
                }
                // Avulsa de antes da V090.
                st.execute("insert into cobranca_aluno(id, consultoria_id, aluno_id, valor_centavos, vencimento, situacao, tipo, descricao) "
                        + "values (gen_random_uuid(), '" + CONSULTORIA_A + "', '" + ALUNO_A + "', 100, current_date, 'ABERTA', 'AVULSA', 'Antiga fictícia')");

                assertThat(flyway(banco).target("90").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(contar(c, "select count(*) from information_schema.columns where table_name = 'cobranca_aluno'"
                        + " and column_name in ('pedido_id', 'parcela') and is_nullable = 'YES'")).isEqualTo(2);
                assertThat(contar(c, "select count(*) from cobranca_aluno where pedido_id is null and parcela is null")).isEqualTo(1);
                // Sem pedido o índice não vale: duas linhas sem pedido_id, do mesmo aluno, coexistem.
                st.execute(avulsa(CONSULTORIA_A, ALUNO_A, "null", "null"));
                assertThat(contar(c, "select count(*) from cobranca_aluno where pedido_id is null")).isEqualTo(2);

                String pedido = "'" + UUID.randomUUID() + "'";
                st.execute(avulsa(CONSULTORIA_A, ALUNO_A, pedido, "1"));
                st.execute(avulsa(CONSULTORIA_A, ALUNO_A, pedido, "2"));
                // Mesmo pedido, mesmo aluno, mesma parcela: barrado pelo índice único parcial.
                assertThatThrownBy(() -> st.execute(avulsa(CONSULTORIA_A, ALUNO_A, pedido, "1")))
                        .hasMessageContaining("ux_cobranca_avulsa_pedido");
                // Outra consultoria com o mesmo UUID de pedido não conflita (o índice leva consultoria_id).
                st.execute(avulsa(CONSULTORIA_B, ALUNO_B, pedido, "1"));
                assertThat(textoDe(c, "select indexdef from pg_indexes where indexname = 'ux_cobranca_avulsa_pedido'"))
                        .contains("UNIQUE").contains("consultoria_id, pedido_id, aluno_id, parcela").contains("WHERE (pedido_id IS NOT NULL)");

                // O CHECK: pedido e parcela vêm juntos, parcela de 1 a 12, e só na AVULSA.
                assertThatThrownBy(() -> st.execute(avulsa(CONSULTORIA_A, ALUNO_A, "'" + UUID.randomUUID() + "'", "null")))
                        .hasMessageContaining("ck_cobranca_pedido_e_parcela");
                assertThatThrownBy(() -> st.execute(avulsa(CONSULTORIA_A, ALUNO_A, "null", "1")))
                        .hasMessageContaining("ck_cobranca_pedido_e_parcela");
                assertThatThrownBy(() -> st.execute(avulsa(CONSULTORIA_A, ALUNO_A, "'" + UUID.randomUUID() + "'", "13")))
                        .hasMessageContaining("ck_cobranca_pedido_e_parcela");
                assertThatThrownBy(() -> st.execute(avulsa(CONSULTORIA_A, ALUNO_A, "'" + UUID.randomUUID() + "'", "0")))
                        .hasMessageContaining("ck_cobranca_pedido_e_parcela");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    /** {@code pedido} e {@code parcela} já vêm como literal SQL ({@code null} ou valor entre aspas). */
    private static String avulsa(UUID consultoria, UUID aluno, String pedido, String parcela) {
        return "insert into cobranca_aluno(id, consultoria_id, aluno_id, valor_centavos, vencimento, situacao, tipo, descricao, "
                + "pedido_id, parcela) values (gen_random_uuid(), '" + consultoria + "', '" + aluno
                + "', 100, current_date, 'ABERTA', 'AVULSA', 'Camiseta fictícia', " + pedido + ", " + parcela + ")";
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
