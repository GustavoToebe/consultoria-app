package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.sql.Array;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V117: com {@code TREINOS_PLANO_APLICAR} ligada por padrão, quem já tem linha em {@code direitos_locais} ganha MOBILIDADE, PDF e
 * EQUIPE que faltarem, sem perder nada. Outro banco na mesma instância: migra até a V116, grava as linhas, aplica a V117 e roda o
 * SQL de novo (idempotente). Só dados fictícios.
 */
class ConsultoriasExistentesGanhamFuncionalidadesIntegrationTest extends AbstractIntegrationTest {

    private static final UUID SEM_NENHUMA = UUID.randomUUID();
    private static final UUID COM_UMA = UUID.randomUUID();
    private static final UUID COM_TODAS = UUID.randomUUID();
    private static final UUID COM_LIMITES = UUID.randomUUID();
    private static final UUID SEM_LINHA = UUID.randomUUID();
    private static final String LIMITES = "{\"alunos_ativos\": 5, \"membros_equipe\": 2}";

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void acrescentaSoOQueFaltaSemCriarLinhaNemMexerEmLimitesEEIdempotente() throws Exception {
        String banco = "v117_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("116").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID id : new UUID[] {SEM_NENHUMA, COM_UMA, COM_TODAS, COM_LIMITES, SEM_LINHA}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + id + "', 'Consultoria fictícia V117', 'v117-"
                            + id + "')");
                }
                direitos(st, SEM_NENHUMA, "{}", "{}");
                direitos(st, COM_UMA, "{}", "{PDF}");
                direitos(st, COM_TODAS, "{}", "{EQUIPE,MOBILIDADE,PDF}");
                // Caixa diferente já conta (o PlanoDaConsultoria compara em maiúsculas) e código fora do catálogo fica.
                direitos(st, COM_LIMITES, LIMITES, "{mobilidade,OUTRA}");
                String antesTodas = escalar(c, "select atualizado_em::text from direitos_locais where consultoria_id = '" + COM_TODAS + "'");

                flyway(banco).target("117").load().migrate();
                conferir(c, antesTodas);

                st.execute(new String(new ClassPathResource("db/migration/V117__funcionalidades_das_consultorias_existentes.sql")
                        .getInputStream().readAllBytes(), StandardCharsets.UTF_8));
                conferir(c, antesTodas);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    private static void conferir(Connection c, String antesTodas) throws SQLException {
        assertThat(funcionalidades(c, SEM_NENHUMA)).containsExactly("MOBILIDADE", "PDF", "EQUIPE");
        assertThat(funcionalidades(c, COM_UMA)).containsExactly("PDF", "MOBILIDADE", "EQUIPE");
        assertThat(funcionalidades(c, COM_TODAS)).containsExactly("EQUIPE", "MOBILIDADE", "PDF");
        assertThat(escalar(c, "select atualizado_em::text from direitos_locais where consultoria_id = '" + COM_TODAS + "'"))
                .isEqualTo(antesTodas);
        assertThat(funcionalidades(c, COM_LIMITES)).containsExactly("mobilidade", "OUTRA", "PDF", "EQUIPE");
        assertThat(escalar(c, "select (limites = '" + LIMITES + "'::jsonb and versao = 7 and plano_codigo = 'GRATUITO')::text "
                + "from direitos_locais where consultoria_id = '" + COM_LIMITES + "'")).isEqualTo("true");
        assertThat(escalar(c, "select count(*)::text from direitos_locais where consultoria_id = '" + SEM_LINHA + "'")).isEqualTo("0");
    }

    private static void direitos(Statement st, UUID consultoria, String limites, String funcionalidades) throws SQLException {
        st.execute("insert into direitos_locais(consultoria_id, contratacao_id, versao, situacao, acesso_liberado, plano_codigo, "
                + "plano_nome, limites, funcionalidades, confirmado_em) values ('" + consultoria + "', gen_random_uuid(), 7, 'ATIVA', "
                + "true, 'GRATUITO', 'Gratuito', '" + limites + "'::jsonb, '" + funcionalidades + "'::text[], now() - interval '1 day')");
    }

    private static List<String> funcionalidades(Connection c, UUID consultoria) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "select funcionalidades from direitos_locais where consultoria_id = '" + consultoria + "'")) {
            assertThat(rs.next()).isTrue();
            Array a = rs.getArray(1);
            return Arrays.asList((String[]) a.getArray());
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

    private static String escalar(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            assertThat(rs.next()).isTrue();
            return rs.getString(1);
        }
    }
}
