package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V042 sobre dados de verdade: o banco sobe até a V041 (Flyway com {@code target}), recebe compromissos no formato antigo (um
 * aluno e uma situação por compromisso) e só então a V042 roda. Cada compromisso vira um participante com a mesma situação,
 * {@code cancelado} sai da situação CANCELADO, realizado e falta seguem ocupando o horário, e o modelo de um aluno só
 * desaparece. Banco novo e descartável na mesma instância do Postgres de teste; dados fictícios.
 */
class CompromissoComVariosAlunosMigracaoIntegrationTest extends AbstractIntegrationTest {

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuario;
    @Value("${spring.datasource.password}") String senha;

    private String urlDe(String banco) {
        int barra = urlPadrao.indexOf('/', "jdbc:postgresql://".length());
        int interrogacao = urlPadrao.indexOf('?', barra);
        String resto = interrogacao < 0 ? "" : urlPadrao.substring(interrogacao);
        return urlPadrao.substring(0, barra + 1) + banco + resto;
    }

    private Connection conectar(String banco) throws SQLException {
        return DriverManager.getConnection(urlDe(banco), usuario, senha);
    }

    private void executar(String banco, String comando) throws SQLException {
        try (Connection c = conectar(banco); Statement st = c.createStatement()) {
            st.execute(comando);
        }
    }

    private static List<String> colunas(Connection c, String tabela) throws SQLException {
        List<String> nomes = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "select column_name from information_schema.columns where table_schema = 'public' and table_name = ?")) {
            ps.setString(1, tabela);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) nomes.add(rs.getString(1));
            }
        }
        return nomes;
    }

    private static void compromisso(Connection c, UUID id, UUID consultoria, UUID aluno, String situacao, int hora) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("insert into compromisso (id, consultoria_id, aluno_id, inicio, "
                + "duracao_minutos, fim, situacao) values (?, ?, ?, ?::timestamptz, 60, ?::timestamptz, ?)")) {
            ps.setObject(1, id);
            ps.setObject(2, consultoria);
            ps.setObject(3, aluno);
            ps.setString(4, String.format("2026-12-01T%02d:00:00Z", hora));
            ps.setString(5, String.format("2026-12-01T%02d:00:00Z", hora + 1));
            ps.setString(6, situacao);
            ps.executeUpdate();
        }
    }

    @Test
    void compromissosAntigosViramParticipantesComAMesmaSituacao() throws Exception {
        String banco = "migracao_v042_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        executar("postgres", "CREATE DATABASE " + banco);
        try {
            Flyway ate41 = Flyway.configure().dataSource(urlDe(banco), usuario, senha).locations("classpath:db/migration")
                    .placeholders(java.util.Map.of("papelApp", "")).target("41").load();
            assertThat(ate41.migrate().migrationsExecuted).isEqualTo(41);

            UUID consultoria = UUID.randomUUID();
            UUID aluno = UUID.randomUUID();
            UUID agendado = UUID.randomUUID();
            UUID cancelado = UUID.randomUUID();
            UUID realizado = UUID.randomUUID();
            UUID faltou = UUID.randomUUID();
            try (Connection c = conectar(banco); Statement st = c.createStatement()) {
                st.execute("insert into consultoria (id, nome, slug) values ('" + consultoria + "', 'Consultoria Fictícia', 'mig-"
                        + consultoria.toString().substring(0, 8) + "')");
                st.execute("insert into aluno (id, consultoria_id, nome) values ('" + aluno + "', '" + consultoria
                        + "', 'Aluno Fictício')");
                compromisso(c, agendado, consultoria, aluno, "AGENDADO", 9);
                compromisso(c, cancelado, consultoria, aluno, "CANCELADO", 11);
                compromisso(c, realizado, consultoria, aluno, "REALIZADO", 13);
                compromisso(c, faltou, consultoria, aluno, "FALTOU", 15);
            }

            // Só até a V042 (a que migra os compromissos antigos); as migrations seguintes não mexem nesses dados.
            Flyway tudo = Flyway.configure().dataSource(urlDe(banco), usuario, senha).locations("classpath:db/migration")
                    .placeholders(java.util.Map.of("papelApp", "")).target("42").load();
            assertThat(tudo.migrate().migrationsExecuted).isEqualTo(1);

            try (Connection c = conectar(banco); Statement st = c.createStatement()) {
                // Um participante por compromisso, com a mesma situação e o mesmo aluno.
                ResultSet rs = st.executeQuery("select compromisso_id, aluno_id, situacao, consultoria_id from compromisso_aluno "
                        + "where consultoria_id = '" + consultoria + "'");
                List<String> participantes = new ArrayList<>();
                while (rs.next()) {
                    assertThat(rs.getObject("aluno_id", UUID.class)).isEqualTo(aluno);
                    assertThat(rs.getObject("consultoria_id", UUID.class)).isEqualTo(consultoria);
                    participantes.add(rs.getString("compromisso_id") + ":" + rs.getString("situacao"));
                }
                assertThat(participantes).containsExactlyInAnyOrder(agendado + ":AGENDADO", cancelado + ":CANCELADO",
                        realizado + ":REALIZADO", faltou + ":FALTOU");

                // Só o cancelado libera o horário; realizado e falta continuam ocupando.
                rs = st.executeQuery("select id, cancelado from compromisso where consultoria_id = '" + consultoria + "'");
                while (rs.next()) {
                    assertThat(rs.getBoolean("cancelado")).as(rs.getString("id"))
                            .isEqualTo(rs.getObject("id", UUID.class).equals(cancelado));
                }

                // O modelo de um aluno só saiu; entraram a série e as tabelas dos avisos.
                assertThat(colunas(c, "compromisso")).doesNotContain("aluno_id", "situacao").contains("cancelado", "serie_id");
                assertThat(colunas(c, "aviso_compromisso")).contains("consultoria_id", "aluno_id", "compromisso_id", "tipo",
                        "inicio", "responsavel_nome", "criado_em", "visto_em");
                rs = st.executeQuery("select indexname, indexdef from pg_indexes where tablename = 'compromisso'");
                List<String> indices = new ArrayList<>();
                String doResponsavel = "";
                while (rs.next()) {
                    indices.add(rs.getString("indexname"));
                    if (rs.getString("indexname").equals("ix_compromisso_responsavel")) doResponsavel = rs.getString("indexdef");
                }
                assertThat(indices).doesNotContain("ix_compromisso_aluno").contains("ix_compromisso_serie");
                assertThat(doResponsavel).contains("WHERE (NOT cancelado)");
                rs = st.executeQuery("select indexdef from pg_indexes where indexname = 'ix_aviso_compromisso_nao_visto'");
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString(1)).contains("WHERE (visto_em IS NULL)");

                // Apagar o aluno leva o participante (FK composta com ON DELETE CASCADE); o compromisso fica.
                st.execute("delete from aluno where id = '" + aluno + "'");
                rs = st.executeQuery("select (select count(*) from compromisso_aluno where consultoria_id = '" + consultoria
                        + "'), (select count(*) from compromisso where consultoria_id = '" + consultoria + "')");
                rs.next();
                assertThat(rs.getLong(1)).isZero();
                assertThat(rs.getLong(2)).isEqualTo(4);
            }
        } finally {
            executar("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }
}
