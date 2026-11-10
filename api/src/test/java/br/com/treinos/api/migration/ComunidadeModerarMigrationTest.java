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
 * V069: quem tinha TREINO_ALTERAR passa a ter COMUNIDADE_MODERAR (perfil padrão ou criado à mão), quem não tinha continua sem,
 * e a consultoria criada depois dá a permissão ao Treinador padrão. Usa outro banco na mesma instância, migrado até a V068.
 * Só dados fictícios.
 */
class ComunidadeModerarMigrationTest extends AbstractIntegrationTest {

    private static final UUID ANTES = UUID.fromString("cccccccc-cccc-cccc-cccc-ccccccccccc1");
    private static final UUID DEPOIS = UUID.fromString("cccccccc-cccc-cccc-cccc-ccccccccccc2");
    private static final String QUEM_ALTERA = "cccccccc-0000-0000-0000-000000000001";
    private static final String SO_LEITOR = "cccccccc-0000-0000-0000-000000000002";

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void preservaQuemJaModeravaEODaAoTreinadorPadraoDeConsultoriaNova() throws Exception {
        String banco = "v069_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("68").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + ANTES + "', 'Consultoria fictícia V069', 'v069-a-" + banco + "')");
                // Perfis criados à mão: um com TREINO_ALTERAR e um só leitor.
                st.execute("insert into perfil(id, consultoria_id, nome) values ('" + QUEM_ALTERA + "', '" + ANTES + "', 'Quem altera treino fictício')");
                st.execute("insert into perfil_permissao(perfil_id, codigo) values ('" + QUEM_ALTERA + "', 'TREINO_LER'),"
                        + " ('" + QUEM_ALTERA + "', 'TREINO_ALTERAR')");
                st.execute("insert into perfil(id, consultoria_id, nome) values ('" + SO_LEITOR + "', '" + ANTES + "', 'Só leitor fictício')");
                st.execute("insert into perfil_permissao(perfil_id, codigo) values ('" + SO_LEITOR + "', 'TREINO_LER')");
                assertThat(codigos(c, ANTES, "Treinador")).contains("TREINO_ALTERAR").doesNotContain("COMUNIDADE_MODERAR");

                assertThat(flyway(banco).target("69").load().migrate().migrationsExecuted).isEqualTo(1);

                // Já existiam: o Treinador padrão e o perfil à mão com TREINO_ALTERAR ganham; leitor, Nutricionista e Assistente não.
                assertThat(codigos(c, ANTES, "Treinador")).contains("COMUNIDADE_MODERAR");
                assertThat(codigos(c, ANTES, "Quem altera treino fictício")).contains("COMUNIDADE_MODERAR");
                assertThat(codigos(c, ANTES, "Só leitor fictício")).doesNotContain("COMUNIDADE_MODERAR");
                assertThat(codigos(c, ANTES, "Nutricionista")).doesNotContain("COMUNIDADE_MODERAR");
                assertThat(codigos(c, ANTES, "Assistente")).doesNotContain("COMUNIDADE_MODERAR");
                // O Administrador tem acesso total e não guarda linha.
                assertThat(codigos(c, ANTES, "Administrador")).isEmpty();

                // Consultoria nova depois da migration: o gatilho dá ao Treinador padrão, só a ele.
                st.execute("insert into consultoria(id, nome, slug) values ('" + DEPOIS + "', 'Consultoria fictícia V069 B', 'v069-b-" + banco + "')");
                assertThat(codigos(c, DEPOIS, "Treinador")).contains("COMUNIDADE_MODERAR");
                assertThat(codigos(c, DEPOIS, "Nutricionista")).doesNotContain("COMUNIDADE_MODERAR");
                assertThat(codigos(c, DEPOIS, "Assistente")).doesNotContain("COMUNIDADE_MODERAR");

                // A coluna nova e a regra do banco: o que a API aceita passa, a pontuação não.
                st.execute("insert into aluno(id, consultoria_id, nome, apelido) values (gen_random_uuid(), '" + DEPOIS
                        + "', 'Aluno fictício', 'João Ñandú-2.0_x')");
                assertThatThrownBy(() -> st.execute("insert into aluno(id, consultoria_id, nome, apelido) values (gen_random_uuid(), '"
                        + DEPOIS + "', 'Aluno fictício', 'ana@x')"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("ck_aluno_apelido");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static List<String> codigos(Connection c, UUID consultoria, String perfil) throws SQLException {
        List<String> lista = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select pp.codigo from perfil p"
                + " left join perfil_permissao pp on pp.perfil_id = p.id where p.consultoria_id = '" + consultoria
                + "' and p.nome = '" + perfil + "'")) {
            while (rs.next()) {
                if (rs.getString(1) != null) {
                    lista.add(rs.getString(1));
                }
            }
        }
        return lista;
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
