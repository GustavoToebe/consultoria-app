package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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

/**
 * Os gatilhos de `consultoria` (perfis padrão, agenda, retorno, inscrição, questionários e, na V069, a permissão
 * COMUNIDADE_MODERAR do Treinador) são funções sem SECURITY DEFINER: rodam com os direitos de quem insere. Em produção quem
 * insere a consultoria é o papel limitado da API (`consultoria_app`), não o dono do banco. Aqui o banco nasce como na VPS
 * (scripts/roles-banco.sql, migrador e app), migra até a última migration como migrador e a consultoria é criada COMO o app:
 * se algum gatilho precisasse de um direito que o app não tem, o INSERT falharia. Só dados fictícios.
 */
class ConsultoriaNovaComoPapelDaApiIntegrationTest extends AbstractIntegrationTest {
    private static final String SENHA_MIGRADOR = "senha-migrador";
    private static final String SENHA_APP = "senha-app";

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void consultoriaCriadaPeloPapelLimitadoDisparaTodosOsGatilhos() throws Exception {
        String sufixo = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String banco = "nova_" + sufixo;
        String migrador = "migrador_" + sufixo;
        String app = "app_" + sufixo;
        UUID consultoria = UUID.randomUUID();
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            admin(banco, Files.readString(Path.of("scripts/roles-banco.sql"), StandardCharsets.UTF_8)
                    .replace("{{banco}}", banco).replace("{{migrador}}", migrador).replace("{{app}}", app)
                    .replace("{{senha_migrador}}", SENHA_MIGRADOR).replace("{{senha_app}}", SENHA_APP));

            // Última migration, como migrador, com o papel do app nos placeholders (como a API no perfil docker).
            var migracao = Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR).locations("classpath:db/migration")
                    .placeholders(Map.of("papelApp", app)).load().migrate();
            assertThat(migracao.success).isTrue();

            try (Connection c = DriverManager.getConnection(urlDe(banco), app, SENHA_APP); Statement st = c.createStatement()) {
                assertThat(st.executeQuery("select current_user").next()).isTrue();
                // Se qualquer gatilho de consultoria faltar permissão ao app, este INSERT lança e o teste quebra.
                st.execute("insert into consultoria(id, nome, slug) values ('" + consultoria + "', 'Consultoria fictícia do app', 'app-" + sufixo + "')");

                // V069: Treinador padrão com COMUNIDADE_MODERAR; os outros dois não.
                assertThat(codigos(c, consultoria, "Treinador")).contains("COMUNIDADE_MODERAR");
                assertThat(codigos(c, consultoria, "Nutricionista")).doesNotContain("COMUNIDADE_MODERAR");
                assertThat(codigos(c, consultoria, "Assistente")).doesNotContain("COMUNIDADE_MODERAR");

                // Os demais gatilhos também rodaram no mesmo INSERT: perfis padrão e questionários padrão nasceram.
                assertThat(contar(c, "select count(*) from perfil where consultoria_id = '" + consultoria + "'")).isGreaterThan(0);
                assertThat(contar(c, "select count(*) from questionario where consultoria_id = '" + consultoria + "'")).isGreaterThan(0);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
            admin("postgres", "DROP ROLE IF EXISTS " + migrador);
            admin("postgres", "DROP ROLE IF EXISTS " + app);
        }
    }

    private static int contar(Connection c, String consulta) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(consulta)) {
            rs.next();
            return rs.getInt(1);
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

    private void admin(String banco, String comando) throws SQLException {
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
