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
 * V092 sobre dados da V091: a tabela {@code responsavel_financeiro} aceita um responsável por aluno, recusa o segundo
 * ({@code ux_responsavel_financeiro_aluno}), aceita o mesmo CPF em dois alunos (sem unicidade), recusa aluno de outra
 * consultoria (FK composta), exige o nome e o limite de tamanho, e apaga a linha junto com o aluno (ON DELETE CASCADE). Usa outro
 * banco na mesma instância, migrado até a V091. Só dados fictícios.
 */
class ResponsavelFinanceiroMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee92");
    private static final UUID OUTRA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee93");
    private static final UUID ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa92");
    private static final UUID OUTRO_ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa93");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void umResponsavelPorAlunoSemUnicidadeDeCpfFkCompostaECascade() throws Exception {
        String banco = "v092_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("91").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID consultoria : new UUID[]{CONSULTORIA, OUTRA}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + consultoria + "', 'Consultoria fictícia V092', 'v092-"
                            + consultoria + "')");
                }
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ALUNO + "', '" + CONSULTORIA + "', 'Aluno fictício')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + OUTRO_ALUNO + "', '" + CONSULTORIA
                        + "', 'Outro aluno fictício')");

                assertThat(flyway(banco).target("92").load().migrate().migrationsExecuted).isEqualTo(1);

                st.execute(responsavel(CONSULTORIA, ALUNO, "'Responsável fictício'", "'529.982.247-25'"));
                // O segundo responsável do mesmo aluno é recusado.
                assertThatThrownBy(() -> st.execute(responsavel(CONSULTORIA, ALUNO, "'Outro responsável'", "null")))
                        .hasMessageContaining("ux_responsavel_financeiro_aluno");
                // O mesmo CPF em outro aluno vale (sem unicidade).
                st.execute(responsavel(CONSULTORIA, OUTRO_ALUNO, "'Responsável fictício'", "'529.982.247-25'"));
                assertThat(contar(c, "select count(*) from responsavel_financeiro where cpf = '529.982.247-25'")).isEqualTo(2);
                // Aluno de outra consultoria (FK composta), nome ausente e nome acima de 120.
                assertThatThrownBy(() -> st.execute(responsavel(OUTRA, ALUNO, "'Responsável cruzado'", "null")))
                        .hasMessageContaining("fk_responsavel_financeiro_aluno");
                assertThatThrownBy(() -> st.execute(responsavel(CONSULTORIA, UUID.randomUUID(), "null", "null")))
                        .hasMessageContaining("nome");
                assertThatThrownBy(() -> st.execute(responsavel(CONSULTORIA, UUID.randomUUID(), "'" + "N".repeat(121) + "'", "null")))
                        .hasMessageContaining("character varying(120)");
                assertThat(contar(c, "select count(*) from information_schema.columns where table_name = 'responsavel_financeiro'"
                        + " and column_name = 'versao' and is_nullable = 'NO'")).isEqualTo(1);

                // Apagar o aluno apaga o responsável dele e só dele.
                st.execute("delete from aluno where id = '" + ALUNO + "'");
                assertThat(contar(c, "select count(*) from responsavel_financeiro where aluno_id = '" + ALUNO + "'")).isZero();
                assertThat(contar(c, "select count(*) from responsavel_financeiro where aluno_id = '" + OUTRO_ALUNO + "'")).isEqualTo(1);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String responsavel(UUID consultoria, UUID aluno, String nome, String cpf) {
        return "insert into responsavel_financeiro(id, consultoria_id, aluno_id, nome, cpf) values (gen_random_uuid(), '" + consultoria
                + "', '" + aluno + "', " + nome + ", " + cpf + ")";
    }

    private static int contar(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
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
