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
 * V098 sobre dados da V097 (contrato fechado): a contratação que já existia vira {@code RECORRENTE} sem valor total, os CHECKs do modo
 * e do total valem daqui em diante, a AVULSA e a RENEGOCIACAO podem ter contratação (e só a do mesmo aluno) mas seguem sem competência,
 * a mensalidade segue exigindo contratação e competência, e o acordo do contrato carrega a contratação com {@code renegociadas = 0}
 * (um por contratação, nunca de outro aluno). Usa outro banco na mesma instância, migrado até a V097. Só dados fictícios.
 */
class ContratoFechadoMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee98");
    private static final UUID ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa98");
    private static final UUID OUTRO_ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa99");
    private static final UUID PLANO = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb98");
    private static final UUID ANTIGA = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccc98");
    private static final UUID FECHADA = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccc99");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void modoTotalCobrancasDoContratoEAcordoDoContrato() throws Exception {
        String banco = "v098_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("97").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V098', 'v098-"
                        + CONSULTORIA + "')");
                for (UUID aluno : new UUID[] {ALUNO, OUTRO_ALUNO}) {
                    st.execute("insert into aluno(id, consultoria_id, nome) values ('" + aluno + "', '" + CONSULTORIA + "', 'Aluno fictício')");
                }
                st.execute("insert into plano_comercial(id, consultoria_id, nome, valor_centavos, periodicidade) values ('" + PLANO + "', '"
                        + CONSULTORIA + "', 'Plano fictício', 10000, 'TRIMESTRAL')");
                // Contratação e avulsa de antes da V098: têm de continuar valendo.
                st.execute(contratacao(ANTIGA, OUTRO_ALUNO, "ENCERRADA", ", encerrada_em", ", now()", ""));
                st.execute("insert into cobranca_aluno(id, consultoria_id, aluno_id, valor_centavos, vencimento, situacao, tipo, descricao) "
                        + "values (gen_random_uuid(), '" + CONSULTORIA + "', '" + ALUNO + "', 100, current_date, 'ABERTA', 'AVULSA', 'Antiga fictícia')");

                assertThat(flyway(banco).target("98").load().migrate().migrationsExecuted).isEqualTo(1);
                assertThat(texto(c, "select modo_cobranca from contratacao_aluno where id = '" + ANTIGA + "'")).isEqualTo("RECORRENTE");
                assertThat(texto(c, "select valor_total_centavos from contratacao_aluno where id = '" + ANTIGA + "'")).isNull();
                assertThat(definicao(c, "contratacao_aluno", "ck_contratacao_modo")).contains("PARCELADO_FIXO").contains("SALDO_ABERTO");

                // Modo e valor total.
                st.execute(contratacao(FECHADA, ALUNO, "ATIVA", ", modo_cobranca, valor_total_centavos", ", 'SALDO_ABERTO', 50000", ""));
                assertThatThrownBy(() -> st.execute(contratacao(UUID.randomUUID(), ALUNO, "PAUSADA", ", modo_cobranca, valor_total_centavos",
                        ", 'RECORRENTE', 5000", ""))).hasMessageContaining("ck_contratacao_valor_total");
                assertThatThrownBy(() -> st.execute(contratacao(UUID.randomUUID(), ALUNO, "PAUSADA", ", modo_cobranca", ", 'PARCELADO_FIXO'", "")))
                        .hasMessageContaining("ck_contratacao_valor_total");
                assertThatThrownBy(() -> st.execute(contratacao(UUID.randomUUID(), ALUNO, "PAUSADA", ", modo_cobranca, valor_total_centavos",
                        ", 'PARCELADO_FIXO', 0", ""))).hasMessageContaining("ck_contratacao_valor_total");
                assertThatThrownBy(() -> st.execute(contratacao(UUID.randomUUID(), ALUNO, "PAUSADA", ", modo_cobranca, valor_total_centavos",
                        ", 'OUTRO', 5000", ""))).hasMessageContaining("ck_contratacao_modo");

                // Cobranças do contrato: AVULSA e RENEGOCIACAO com contratação e sem competência; as regras antigas seguem.
                UUID acordo = acordoDoContrato(st, FECHADA, ALUNO, 0);
                st.execute(cobranca("AVULSA", "'Entrada'", "null", "'" + FECHADA + "'", ALUNO, "null"));
                st.execute(cobranca("RENEGOCIACAO", "'Parcela 1/2'", "'" + acordo + "'", "'" + FECHADA + "'", ALUNO, "null"));
                assertThat(inteiro(c, "select count(*) from cobranca_aluno where contratacao_id = '" + FECHADA + "'")).isEqualTo(2);
                assertThat(definicao(c, "cobranca_aluno", "ck_cobranca_contratacao_so_avulsa")).contains("RENEGOCIACAO");
                assertThatThrownBy(() -> st.execute(cobranca("AVULSA", "'Com competência'", "null", "'" + FECHADA + "'", ALUNO, "current_date")))
                        .hasMessageContaining("ck_cobranca_contratacao_so_avulsa");
                assertThatThrownBy(() -> st.execute(cobranca("MENSALIDADE", "null", "null", "null", ALUNO, "current_date")))
                        .hasMessageContaining("ck_cobranca_contratacao_so_avulsa");
                assertThatThrownBy(() -> st.execute(cobranca("MENSALIDADE", "null", "null", "'" + FECHADA + "'", ALUNO, "null")))
                        .hasMessageContaining("ck_cobranca_contratacao_so_avulsa");
                assertThatThrownBy(() -> st.execute(cobranca("AVULSA", "null", "null", "'" + FECHADA + "'", ALUNO, "null")))
                        .hasMessageContaining("ck_cobranca_descricao_so_avulsa");
                // A FK composta barra a contratação de outro aluno.
                assertThatThrownBy(() -> st.execute(cobranca("AVULSA", "'De outro aluno'", "null", "'" + FECHADA + "'", OUTRO_ALUNO, "null")))
                        .hasMessageContaining("fk_cobranca_contratacao");

                // Acordo do contrato: renegociadas = 0 só com contratação; o de renegociação segue de 1 a 100; um por contratação.
                assertThatThrownBy(() -> acordoDoContrato(st, FECHADA, ALUNO, 0)).hasMessageContaining("ux_acordo_contratacao");
                assertThatThrownBy(() -> acordoDoContrato(st, ANTIGA, OUTRO_ALUNO, 1)).hasMessageContaining("ck_acordo_renegociadas");
                assertThatThrownBy(() -> st.execute(acordo(null, ALUNO, 0))).hasMessageContaining("ck_acordo_renegociadas");
                assertThatThrownBy(() -> st.execute(acordo(null, ALUNO, 101))).hasMessageContaining("ck_acordo_renegociadas");
                st.execute(acordo(null, ALUNO, 3));
                assertThatThrownBy(() -> acordoDoContrato(st, ANTIGA, ALUNO, 0)).hasMessageContaining("fk_acordo_contratacao");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String contratacao(UUID id, UUID aluno, String situacao, String colunasExtras, String valoresExtras, String fim) {
        return "insert into contratacao_aluno(id, consultoria_id, aluno_id, plano_comercial_id, periodicidade, valor_centavos, inicio, ancora, "
                + "dia_vencimento, situacao" + colunasExtras + ") values ('" + id + "', '" + CONSULTORIA + "', '" + aluno + "', '" + PLANO
                + "', 'TRIMESTRAL', 50000, current_date, current_date, 5, '" + situacao + "'" + valoresExtras + ")" + fim;
    }

    /** {@code descricao}, {@code acordo} e {@code contratacao} já vêm como literal SQL; {@code competencia} idem. */
    private static String cobranca(String tipo, String descricao, String acordo, String contratacao, UUID aluno, String competencia) {
        return "insert into cobranca_aluno(id, consultoria_id, aluno_id, contratacao_id, competencia, valor_centavos, vencimento, situacao, tipo, "
                + "descricao, acordo_id) values (gen_random_uuid(), '" + CONSULTORIA + "', '" + aluno + "', " + contratacao + ", " + competencia
                + ", 100, current_date, 'ABERTA', '" + tipo + "', " + descricao + ", " + acordo + ")";
    }

    private static String acordo(UUID contratacao, UUID aluno, int renegociadas) {
        return "insert into acordo_de_cobranca(id, consultoria_id, aluno_id, pedido_id, renegociadas, parcelas, total_centavos, contratacao_id) "
                + "values ('" + UUID.randomUUID() + "', '" + CONSULTORIA + "', '" + aluno + "', '" + UUID.randomUUID() + "', " + renegociadas
                + ", 2, 1000, " + (contratacao == null ? "null" : "'" + contratacao + "'") + ")";
    }

    private static UUID acordoDoContrato(Statement st, UUID contratacao, UUID aluno, int renegociadas) throws Exception {
        String sql = acordo(contratacao, aluno, renegociadas);
        st.execute(sql);
        return UUID.fromString(sql.split("'")[1]);
    }

    private static String definicao(Connection c, String tabela, String constraint) throws Exception {
        return texto(c, "select pg_get_constraintdef(oid) from pg_constraint where conname = '" + constraint + "' and conrelid = '" + tabela
                + "'::regclass");
    }

    private static int inteiro(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private static String texto(Connection c, String sql) throws Exception {
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
