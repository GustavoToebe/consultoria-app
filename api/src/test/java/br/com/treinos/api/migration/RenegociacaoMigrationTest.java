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
 * V094 sobre dados da V093: {@code situacao} e {@code tipo} aceitam RENEGOCIADA e RENEGOCIACAO (as colunas cabem as duas palavras e os
 * CHECKs foram refeitos), a parcela do acordo é como a avulsa (sem contratação nem competência, com descrição), o {@code acordo_id} vem
 * junto da situação e do tipo novos e só neles, a FK composta barra acordo de outra consultoria, o acordo é único por pedido e por
 * consultoria e a avulsa que já existia segue intacta. Usa outro banco na mesma instância, migrado até a V093. Só dados fictícios.
 */
class RenegociacaoMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA_A = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee94");
    private static final UUID CONSULTORIA_B = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee95");
    private static final UUID ALUNO_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa94");
    private static final UUID ALUNO_B = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa95");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void situacaoETipoNovosChecksDoAcordoFkCompostaEUnicidadeDoPedido() throws Exception {
        String banco = "v094_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("93").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID[] par : new UUID[][] {{CONSULTORIA_A, ALUNO_A}, {CONSULTORIA_B, ALUNO_B}}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + par[0] + "', 'Consultoria fictícia V094', 'v094-"
                            + par[0] + "')");
                    st.execute("insert into aluno(id, consultoria_id, nome) values ('" + par[1] + "', '" + par[0] + "', 'Aluno fictício')");
                }
                // Avulsa de antes da V094: tem de continuar valendo.
                st.execute("insert into cobranca_aluno(id, consultoria_id, aluno_id, valor_centavos, vencimento, situacao, tipo, descricao) "
                        + "values (gen_random_uuid(), '" + CONSULTORIA_A + "', '" + ALUNO_A + "', 100, current_date, 'ABERTA', 'AVULSA', 'Antiga fictícia')");

                assertThat(flyway(banco).target("94").load().migrate().migrationsExecuted).isEqualTo(1);
                assertThat(contar(c, "select count(*) from cobranca_aluno where tipo = 'AVULSA' and situacao = 'ABERTA' and acordo_id is null"))
                        .isEqualTo(1);

                // As colunas cabem as palavras novas (situacao era varchar(10); tipo, varchar(12)).
                assertThat(contar(c, "select character_maximum_length from information_schema.columns where table_name = 'cobranca_aluno' "
                        + "and column_name = 'situacao'")).isGreaterThanOrEqualTo("RENEGOCIADA".length());
                assertThat(contar(c, "select character_maximum_length from information_schema.columns where table_name = 'cobranca_aluno' "
                        + "and column_name = 'tipo'")).isGreaterThanOrEqualTo("RENEGOCIACAO".length());
                // O que o banco tem de verdade (não o que a migration diz): os quatro CHECKs refeitos.
                assertThat(definicao(c, "ck_cobranca_situacao")).contains("RENEGOCIADA").contains("CONTESTADA");
                assertThat(definicao(c, "ck_cobranca_tipo")).contains("RENEGOCIACAO").contains("SAIDA");
                assertThat(definicao(c, "ck_cobranca_contratacao_so_avulsa")).contains("RENEGOCIACAO");
                assertThat(definicao(c, "ck_cobranca_descricao_so_avulsa")).contains("RENEGOCIACAO");
                assertThat(textoDe(c, "select indexdef from pg_indexes where indexname = 'ix_cobranca_acordo'"))
                        .contains("consultoria_id, acordo_id").contains("acordo_id IS NOT NULL");

                UUID acordo = acordo(st, CONSULTORIA_A, ALUNO_A, UUID.randomUUID(), 2, 3, 30_000);
                UUID acordoDeB = acordo(st, CONSULTORIA_B, ALUNO_B, UUID.randomUUID(), 1, 1, 1_000);

                // Parcela do acordo: como a avulsa (sem contratação nem competência), com descrição fixa e o acordo.
                st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "RENEGOCIACAO", "ABERTA", "'Renegociação (Parcela 1/3)'", "'" + acordo + "'"));
                // Original renegociada (aqui uma avulsa; a regra é da situação): precisa do acordo.
                st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "AVULSA", "RENEGOCIADA", "'Original fictícia'", "'" + acordo + "'"));
                assertThat(contar(c, "select count(*) from cobranca_aluno where acordo_id = '" + acordo + "'")).isEqualTo(2);

                // acordo_id vem junto: parcela e RENEGOCIADA sem acordo são recusadas; acordo numa ABERTA comum também.
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "RENEGOCIACAO", "ABERTA", "'Renegociação'", "null")))
                        .hasMessageContaining("ck_cobranca_acordo");
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "AVULSA", "RENEGOCIADA", "'Sem acordo'", "null")))
                        .hasMessageContaining("ck_cobranca_acordo");
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "AVULSA", "ABERTA", "'Aberta com acordo'", "'" + acordo + "'")))
                        .hasMessageContaining("ck_cobranca_acordo");
                // Parcela sem descrição, ou com contratação, ou com pedido da avulsa, não vale.
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "RENEGOCIACAO", "ABERTA", "null", "'" + acordo + "'")))
                        .hasMessageContaining("ck_cobranca_descricao_so_avulsa");
                assertThatThrownBy(() -> st.execute("insert into cobranca_aluno(id, consultoria_id, aluno_id, valor_centavos, vencimento, "
                        + "situacao, tipo, descricao, acordo_id, pedido_id, parcela) values (gen_random_uuid(), '" + CONSULTORIA_A + "', '"
                        + ALUNO_A + "', 100, current_date, 'ABERTA', 'RENEGOCIACAO', 'Renegociação', '" + acordo + "', gen_random_uuid(), 1)"))
                        .hasMessageContaining("ck_cobranca_pedido_e_parcela");
                // A mensalidade segue exigindo contratação e competência (o relaxamento é só da avulsa e da parcela do acordo).
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "MENSALIDADE", "ABERTA", "null", "null")))
                        .hasMessageContaining("ck_cobranca_contratacao_so_avulsa");
                // Situação e tipo fora da lista.
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "AVULSA", "RENEGOCIAD", "'Fora da lista'", "null")))
                        .hasMessageContaining("ck_cobranca_situacao");
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "RENEGOCIACOES", "ABERTA", "'Fora da lista'", "null")))
                        .hasMessageContaining("character varying(12)");
                // A FK composta barra o acordo de outra consultoria.
                assertThatThrownBy(() -> st.execute(cobranca(CONSULTORIA_A, ALUNO_A, "RENEGOCIACAO", "ABERTA", "'Renegociação'", "'" + acordoDeB + "'")))
                        .hasMessageContaining("fk_cobranca_acordo");

                // O acordo: um por pedido na consultoria (o mesmo UUID em outra consultoria vale), contagens e total nos limites, aluno da consultoria.
                UUID pedido = UUID.randomUUID();
                acordo(st, CONSULTORIA_A, ALUNO_A, pedido, 1, 2, 500);
                assertThatThrownBy(() -> acordo(st, CONSULTORIA_A, ALUNO_A, pedido, 1, 2, 500)).hasMessageContaining("ux_acordo_pedido");
                acordo(st, CONSULTORIA_B, ALUNO_B, pedido, 1, 2, 500);
                assertThatThrownBy(() -> acordo(st, CONSULTORIA_A, ALUNO_A, UUID.randomUUID(), 0, 2, 500)).hasMessageContaining("ck_acordo_renegociadas");
                assertThatThrownBy(() -> acordo(st, CONSULTORIA_A, ALUNO_A, UUID.randomUUID(), 101, 2, 500)).hasMessageContaining("ck_acordo_renegociadas");
                assertThatThrownBy(() -> acordo(st, CONSULTORIA_A, ALUNO_A, UUID.randomUUID(), 1, 13, 500)).hasMessageContaining("ck_acordo_parcelas");
                assertThatThrownBy(() -> acordo(st, CONSULTORIA_A, ALUNO_A, UUID.randomUUID(), 1, 2, 0)).hasMessageContaining("ck_acordo_total");
                assertThatThrownBy(() -> acordo(st, CONSULTORIA_A, ALUNO_B, UUID.randomUUID(), 1, 2, 500)).hasMessageContaining("fk_acordo_aluno");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static UUID acordo(Statement st, UUID consultoria, UUID aluno, UUID pedido, int renegociadas, int parcelas, long total)
            throws Exception {
        UUID id = UUID.randomUUID();
        st.execute("insert into acordo_de_cobranca(id, consultoria_id, aluno_id, pedido_id, renegociadas, parcelas, total_centavos) values ('"
                + id + "', '" + consultoria + "', '" + aluno + "', '" + pedido + "', " + renegociadas + ", " + parcelas + ", " + total + ")");
        return id;
    }

    /** {@code descricao} e {@code acordo} já vêm como literal SQL ({@code null} ou valor entre aspas); sem contratação nem competência. */
    private static String cobranca(UUID consultoria, UUID aluno, String tipo, String situacao, String descricao, String acordo) {
        return "insert into cobranca_aluno(id, consultoria_id, aluno_id, valor_centavos, vencimento, situacao, tipo, descricao, acordo_id) "
                + "values (gen_random_uuid(), '" + consultoria + "', '" + aluno + "', 100, current_date, '" + situacao + "', '" + tipo
                + "', " + descricao + ", " + acordo + ")";
    }

    private static String definicao(Connection c, String constraint) throws Exception {
        return textoDe(c, "select pg_get_constraintdef(oid) from pg_constraint where conname = '" + constraint
                + "' and conrelid = 'cobranca_aluno'::regclass");
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
