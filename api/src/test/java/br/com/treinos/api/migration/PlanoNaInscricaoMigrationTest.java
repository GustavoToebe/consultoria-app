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
 * V111: a opção de preço do link nasce desligada para quem já existia, a inscrição antiga fica sem plano, a FK composta
 * recusa plano de outra consultoria e apagar o plano só zera a coluna (nunca a consultoria nem a inscrição). O banco novo é
 * migrado até a V110 e só então recebe a V111. Só dados fictícios.
 */
class PlanoNaInscricaoMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-0000-0000-0000-000000000111");
    private static final UUID OUTRA = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b2");
    private static final UUID ANTIGA = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b3");
    private static final UUID NOVA = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b4");
    private static final UUID PLANO = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b5");
    private static final UUID PLANO_ALHEIO = UUID.fromString("eeeeeeee-0000-0000-0000-0000000001b6");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void v111OpcaoDesligadaPorPadraoFkCompostaESetNullSoDaColunaDoPlano() throws Exception {
        String banco = "v111_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("110").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                st.execute("insert into consultoria(id, nome, slug) values ('" + CONSULTORIA + "', 'Consultoria fictícia V111', 'v111-" + banco + "')");
                st.execute("insert into consultoria(id, nome, slug) values ('" + OUTRA + "', 'Outra fictícia V111', 'v111b-" + banco + "')");
                st.execute("insert into inscricao(id, consultoria_id, nome, whatsapp) values ('" + ANTIGA + "', '" + CONSULTORIA
                        + "', 'Inscrição antiga fictícia', '(11) 98765-4321')");
                st.execute(plano(PLANO, CONSULTORIA, "Plano fictício"));
                st.execute(plano(PLANO_ALHEIO, OUTRA, "Plano alheio fictício"));

                assertThat(flyway(banco).target("111").load().migrate().migrationsExecuted).isEqualTo(1);

                assertThat(texto(c, "select plano_comercial_id from inscricao where id = '" + ANTIGA + "'")).isNull();
                assertThat(texto(c, "select count(*) from questionario where mostrar_preco_dos_planos")).isEqualTo("0");

                // Plano da própria consultoria vale; o de outra é recusado pela FK composta.
                st.execute("update inscricao set plano_comercial_id = '" + PLANO + "' where id = '" + ANTIGA + "'");
                assertThat(texto(c, "select plano_comercial_id from inscricao where id = '" + ANTIGA + "'")).isEqualTo(PLANO.toString());
                assertThatThrownBy(() -> st.execute("insert into inscricao(id, consultoria_id, nome, whatsapp, plano_comercial_id) values ('"
                        + NOVA + "', '" + CONSULTORIA + "', 'Inscrição fictícia', '(11) 98765-4322', '" + PLANO_ALHEIO + "')"))
                        .hasMessageContaining("fk_inscricao_plano_comercial");

                // Apagar o plano zera só a coluna: a inscrição e a consultoria ficam.
                st.execute("delete from plano_comercial where id = '" + PLANO + "'");
                assertThat(texto(c, "select plano_comercial_id from inscricao where id = '" + ANTIGA + "'")).isNull();
                assertThat(texto(c, "select consultoria_id from inscricao where id = '" + ANTIGA + "'")).isEqualTo(CONSULTORIA.toString());
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static String plano(UUID id, UUID consultoria, String nome) {
        return "insert into plano_comercial(id, consultoria_id, nome, valor_centavos, periodicidade) values ('" + id + "', '"
                + consultoria + "', '" + nome + "', 9900, 'MENSAL')";
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
