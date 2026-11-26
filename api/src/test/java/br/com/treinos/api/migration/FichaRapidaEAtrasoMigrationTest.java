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
 * V104: o CHECK {@code ck_aluno_acesso_desativado} passa a aceitar MANUAL e ATRASO (refeito NOT VALID e validado), quem já
 * estava MANUAL ou com o acesso normal continua válido e o par em/motivo segue obrigatório; a inscrição ganha
 * {@code aceita_sem_cobranca} (falsa para quem existia) com {@code ck_inscricao_cortesia_so_aceita}. Banco próprio na mesma
 * instância, migrado até a V103. Só dados fictícios.
 */
class FichaRapidaEAtrasoMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-0000-0000-0000-000000000104");
    private static final UUID MANUAL = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b1");
    private static final UUID NORMAL = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b2");
    private static final UUID INSCRICAO = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b3");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void v104AceitaAtrasoMantemOsDadosAnterioresEValidaOsChecks() throws Exception {
        String banco = "v104_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("103").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V104', 'v104-" + banco + "')");
                st.execute("insert into aluno(id, consultoria_id, nome, acesso_desativado_em, acesso_desativado_motivo) values ('"
                        + MANUAL + "', '" + CONSULTORIA + "', 'Aluno manual fictício', now(), 'MANUAL')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + NORMAL + "', '" + CONSULTORIA + "', 'Aluno normal fictício')");
                st.execute("insert into inscricao(id, consultoria_id, nome, whatsapp) values ('" + INSCRICAO + "', '" + CONSULTORIA
                        + "', 'Pessoa fictícia', '45999990000')");
                // Antes da V104 o ATRASO é recusado.
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = 'ATRASO' where id = '" + NORMAL + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");

                assertThat(flyway(banco).target("104").load().migrate().migrationsExecuted).isEqualTo(1);

                // Dados anteriores intactos e os dois CHECKs validados (convalidated = o NOT VALID foi seguido do VALIDATE).
                assertThat(texto(c, "select acesso_desativado_motivo from aluno where id = '" + MANUAL + "'")).isEqualTo("MANUAL");
                assertThat(texto(c, "select acesso_desativado_motivo from aluno where id = '" + NORMAL + "'")).isNull();
                assertThat(texto(c, "select aceita_sem_cobranca::text from inscricao where id = '" + INSCRICAO + "'")).isEqualTo("false");
                assertThat(texto(c, "select string_agg(conname || '=' || convalidated, ',' order by conname) from pg_constraint "
                        + "where conname in ('ck_aluno_acesso_desativado', 'ck_inscricao_cortesia_so_aceita')"))
                        .isEqualTo("ck_aluno_acesso_desativado=true,ck_inscricao_cortesia_so_aceita=true");
                assertThat(texto(c, "select pg_get_constraintdef(oid) from pg_constraint where conname = 'ck_aluno_acesso_desativado'"))
                        .contains("MANUAL").contains("ATRASO");

                // ATRASO entra; MANUAL e ATRASO trocam entre si; o par continua obrigatório e outro motivo não entra.
                st.execute("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = 'ATRASO' where id = '" + NORMAL + "'");
                st.execute("update aluno set acesso_desativado_motivo = 'MANUAL' where id = '" + NORMAL + "'");
                st.execute("update aluno set acesso_desativado_em = null, acesso_desativado_motivo = null where id = '" + NORMAL + "'");
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_em = now() where id = '" + NORMAL + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_motivo = 'ATRASO' where id = '" + NORMAL + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
                assertThatThrownBy(() -> st.execute("update aluno set acesso_desativado_em = now(), acesso_desativado_motivo = 'OUTRO' where id = '" + NORMAL + "'"))
                        .hasMessageContaining("ck_aluno_acesso_desativado");
                assertThat(texto(c, "select count(*)::text from information_schema.columns where table_name = 'aluno' and column_name = 'acesso_pausado_em'"))
                        .isEqualTo("0");

                // Cortesia só em inscrição aceita e sem pagamento confirmado.
                assertThatThrownBy(() -> st.execute("update inscricao set aceita_sem_cobranca = true where id = '" + INSCRICAO + "'"))
                        .hasMessageContaining("ck_inscricao_cortesia_so_aceita");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
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
