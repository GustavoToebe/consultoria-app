package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.TreinosApiApplication;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Papéis do banco (docs/papeis-banco.md), como na VPS: banco NOVO e vazio, papéis criados pelo scripts/roles-banco.sql, e a
 * API subindo de verdade (perfil docker) com o migrador no Flyway e no módulo de autenticação e o papel só de dados em DB_*.
 * Prova que o app opera dados, não altera schema e é recusado nos dois históricos (flyway_schema_history e
 * plataforma.historico_migracao) já na primeira subida, sem passo manual, e que não entra no banco de outro aplicativo.
 */
class PapeisBancoIntegrationTest extends AbstractIntegrationTest {
    private static final String SENHA_MIGRADOR = "senha-migrador";
    private static final String SENHA_APP = "senha-app";

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    private static String sql(String arquivo) throws Exception {
        return Files.readString(Path.of(arquivo), StandardCharsets.UTF_8);
    }

    private void admin(String banco, String comando) throws SQLException {
        try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
            st.execute(comando);
        }
    }

    /** Mesma instância do Postgres de teste, outro banco. */
    private String urlDe(String banco) {
        int barra = urlPadrao.indexOf('/', "jdbc:postgresql://".length());
        int interrogacao = urlPadrao.indexOf('?', barra);
        String resto = interrogacao < 0 ? "" : urlPadrao.substring(interrogacao);
        return urlPadrao.substring(0, barra + 1) + banco + resto;
    }

    /** Banco vazio e sem dono definido, como o `CREATE DATABASE` da VPS, e os papéis criados pelo roles-banco.sql. */
    private void bancoNovoComPapeis(String banco, String migrador, String app) throws Exception {
        admin("postgres", "CREATE DATABASE " + banco);
        admin(banco, sql("scripts/roles-banco.sql").replace("{{banco}}", banco).replace("{{migrador}}", migrador)
                .replace("{{app}}", app).replace("{{senha_migrador}}", SENHA_MIGRADOR).replace("{{senha_app}}", SENHA_APP));
    }

    private void limpar(String banco, String migrador, String app) throws SQLException {
        admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        admin("postgres", "DROP ROLE IF EXISTS " + migrador);
        admin("postgres", "DROP ROLE IF EXISTS " + app);
    }

    private Connection como(String banco, String papel, String senha) throws SQLException {
        return DriverManager.getConnection(urlDe(banco), papel, senha);
    }

    private static String sufixo() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    /** A API de verdade, no perfil docker: DB_* do app, MIGRATION_DB_* do migrador e PLATAFORMA_PAPEL_APP. */
    private ConfigurableApplicationContext subirApi(String banco, String migrador, String app) {
        return new SpringApplicationBuilder(TreinosApiApplication.class)
                .web(WebApplicationType.SERVLET)
                .profiles("test", "docker")
                .properties("server.port=0",
                        "DB_URL=" + urlDe(banco), "DB_USUARIO=" + app, "DB_SENHA=" + SENHA_APP,
                        "MIGRATION_DB_USER=" + migrador, "MIGRATION_DB_PASSWORD=" + SENHA_MIGRADOR,
                        "PLATAFORMA_PAPEL_APP=" + app)
                // Argumento de linha de comando vence o application-test.yml: padrão de produção, fotos desligadas.
                .run("--treinos.fotos.habilitado=false");
    }

    private void assertHistoricosFechadosParaOApp(String banco, String app) throws SQLException {
        try (Connection c = como(banco, app, SENHA_APP); Statement st = c.createStatement()) {
            for (String historico : new String[] {"flyway_schema_history", "plataforma.historico_migracao"}) {
                assertThatThrownBy(() -> st.executeQuery("SELECT * FROM " + historico)).as(historico).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("INSERT INTO " + historico + " (installed_rank, description, type, script, checksum, installed_by, execution_time, success)"
                        + " VALUES (9999, 'x', 'SQL', 'x', 0, 'x', 0, true)")).as(historico).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("UPDATE " + historico + " SET success = false")).as(historico).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("DELETE FROM " + historico)).as(historico).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("TRUNCATE " + historico)).as(historico).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("DROP TABLE " + historico)).as(historico).hasMessageContaining("must be owner");
            }
        }
    }

    @Test
    void apiSobeComOMigradorEOAppSoOperaDadosEFicaForaDosHistoricos() throws Exception {
        String sufixo = sufixo();
        String banco = "papeis_" + sufixo;
        String migrador = "migrador_" + sufixo;
        String app = "app_" + sufixo;
        String outroBanco = "outro_" + sufixo;
        String outroMigrador = "migrador2_" + sufixo;
        String outroApp = "app2_" + sufixo;
        Path novaMigration = Files.createTempDirectory("migration-nova");
        Files.writeString(novaMigration.resolve("V9001__tabela_do_migrador.sql"),
                """
                CREATE TABLE nova_tabela(id bigserial PRIMARY KEY, nome text);
                """);
        try {
            bancoNovoComPapeis(banco, migrador, app);
            bancoNovoComPapeis(outroBanco, outroMigrador, outroApp);

            // 1. Primeira subida: a API roda com o papel de dados; quem cria public e plataforma é o migrador.
            try (ConfigurableApplicationContext api = subirApi(banco, migrador, app)) {
                assertThat(api.isRunning()).isTrue();
            }
            try (Connection c = como(banco, usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (String tabela : new String[] {"public.flyway_schema_history", "public.consultoria", "plataforma.historico_migracao", "plataforma.refresh_token"}) {
                    try (var rs = st.executeQuery("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = '" + tabela + "'::regclass")) {
                        rs.next();
                        assertThat(rs.getString(1)).as("dono de " + tabela).isEqualTo(migrador);
                    }
                }
                try (var rs = st.executeQuery("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '" + banco + "'")) {
                    rs.next();
                    assertThat(rs.getString(1)).as("dono do banco").isEqualTo(migrador);
                }
                try (var rs = st.executeQuery("SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = '" + app + "'")) {
                    rs.next();
                    assertThat(new boolean[] {rs.getBoolean(1), rs.getBoolean(2), rs.getBoolean(3), rs.getBoolean(4)}).containsOnly(false);
                }
            }
            // Já na primeira subida, sem rodar mais nada: os dois históricos estão fechados.
            assertHistoricosFechadosParaOApp(banco, app);

            // 2. Segunda subida (nada a migrar): continua fechado.
            try (ConfigurableApplicationContext api = subirApi(banco, migrador, app)) {
                assertThat(api.isRunning()).isTrue();
            }
            assertHistoricosFechadosParaOApp(banco, app);

            // 3. Migration nova só com as credenciais do migrador: o app enxerga a tabela nova (privilégios padrão) e a sequência.
            var nova = Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR)
                    .locations("classpath:db/migration", "filesystem:" + novaMigration.toAbsolutePath())
                    .placeholders(Map.of("papelApp", app)).load().migrate();
            assertThat(nova.success).isTrue();
            assertThat(nova.migrationsExecuted).isEqualTo(1);

            // 4. A API (app): dados sim, schema não, histórico não, outro banco não.
            try (Connection c = como(banco, app, SENHA_APP); Statement st = c.createStatement()) {
                st.execute("INSERT INTO nova_tabela (nome) VALUES ('tabela criada pelo migrador')");
                try (var rs = st.executeQuery("SELECT count(*) FROM nova_tabela")) {
                    rs.next();
                    assertThat(rs.getInt(1)).isEqualTo(1);
                }
                st.execute("UPDATE nova_tabela SET nome = 'ok'");
                st.execute("DELETE FROM nova_tabela");
                st.execute("SELECT count(*) FROM consultoria");
                st.execute("SELECT count(*) FROM plataforma.refresh_token");
                st.execute("DELETE FROM plataforma.refresh_token");

                assertThatThrownBy(() -> st.execute("CREATE TABLE intruso(id int)")).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("CREATE TABLE plataforma.intruso(id int)")).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("ALTER TABLE nova_tabela ADD COLUMN x int")).hasMessageContaining("must be owner");
                assertThatThrownBy(() -> st.execute("ALTER TABLE plataforma.refresh_token ADD COLUMN x int")).hasMessageContaining("must be owner");
                assertThatThrownBy(() -> st.execute("DROP TABLE nova_tabela")).hasMessageContaining("must be owner");
                assertThatThrownBy(() -> st.execute("TRUNCATE nova_tabela")).hasMessageContaining("permission denied");
                assertThatThrownBy(() -> st.execute("DROP SCHEMA plataforma CASCADE")).hasMessageContaining("must be owner");
            }
            assertHistoricosFechadosParaOApp(banco, app);
            assertThatThrownBy(() -> como(outroBanco, app, SENHA_APP)).hasMessageContaining("permission denied for database");
            assertThatThrownBy(() -> como(outroBanco, migrador, SENHA_MIGRADOR)).hasMessageContaining("permission denied for database");
            assertThatThrownBy(() -> como(banco, outroApp, SENHA_APP)).hasMessageContaining("permission denied for database");
        } finally {
            limpar(banco, migrador, app);
            limpar(outroBanco, outroMigrador, outroApp);
        }
    }

    /** O callback roda a cada subida, também sem migration nova: se alguém reabrir o histórico, a próxima subida fecha. */
    @Test
    void callbackFechaOHistoricoDeNovoMesmoSemMigrationNova() throws Exception {
        String sufixo = sufixo();
        String banco = "novo_" + sufixo;
        String migrador = "migrador_" + sufixo;
        String app = "app_" + sufixo;
        try {
            bancoNovoComPapeis(banco, migrador, app);
            Map<String, String> papel = Map.of("papelApp", app);

            var primeira = Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR).locations("classpath:db/migration")
                    .placeholders(papel).load().migrate();
            assertThat(primeira.success).isTrue();
            assertThat(primeira.migrationsExecuted).isEqualTo(33);
            try (Connection c = como(banco, app, SENHA_APP); Statement st = c.createStatement()) {
                assertThatThrownBy(() -> st.executeQuery("SELECT * FROM flyway_schema_history")).hasMessageContaining("permission denied");
            }

            admin(banco, "GRANT SELECT, INSERT, UPDATE, DELETE ON public.flyway_schema_history TO " + app);
            try (Connection c = como(banco, app, SENHA_APP); Statement st = c.createStatement()) {
                st.execute("SELECT count(*) FROM flyway_schema_history");
            }
            var segunda = Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR).locations("classpath:db/migration")
                    .placeholders(papel).load().migrate();
            assertThat(segunda.success).isTrue();
            assertThat(segunda.migrationsExecuted).isZero();
            try (Connection c = como(banco, app, SENHA_APP); Statement st = c.createStatement()) {
                assertThatThrownBy(() -> st.executeQuery("SELECT * FROM flyway_schema_history")).hasMessageContaining("permission denied");
            }
        } finally {
            limpar(banco, migrador, app);
        }
    }

    @Test
    void semPapelInformadoOCallbackNaoFazNada() throws Exception {
        String sufixo = sufixo();
        String banco = "vazio_" + sufixo;
        String migrador = "migrador_" + sufixo;
        String app = "app_" + sufixo;
        try {
            bancoNovoComPapeis(banco, migrador, app);
            Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR).locations("classpath:db/migration")
                    .placeholders(Map.of("papelApp", "")).load().migrate();
            try (Connection c = como(banco, app, SENHA_APP); Statement st = c.createStatement()) {
                st.execute("SELECT count(*) FROM flyway_schema_history");
            }
        } finally {
            limpar(banco, migrador, app);
        }
    }

    /** Sem separação de papéis (API e Flyway no mesmo usuário) o callback não pode tirar o acesso do dono da tabela. */
    @Test
    void papelIgualAoDoFlywayNaoTiraOAcessoDoDono() throws Exception {
        String sufixo = sufixo();
        String banco = "mesmo_" + sufixo;
        String migrador = "migrador_" + sufixo;
        String app = "app_" + sufixo;
        try {
            bancoNovoComPapeis(banco, migrador, app);
            for (int vez = 0; vez < 2; vez++) {
                var r = Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR).locations("classpath:db/migration")
                        .placeholders(Map.of("papelApp", migrador)).load().migrate();
                assertThat(r.success).isTrue();
            }
            try (Connection c = como(banco, migrador, SENHA_MIGRADOR); Statement st = c.createStatement()) {
                st.execute("SELECT count(*) FROM flyway_schema_history");
            }
        } finally {
            limpar(banco, migrador, app);
        }
    }

    @Test
    void papelInformadoQueNaoExisteFalhaASubida() throws Exception {
        String sufixo = sufixo();
        String banco = "inexistente_" + sufixo;
        String migrador = "migrador_" + sufixo;
        String app = "app_" + sufixo;
        try {
            bancoNovoComPapeis(banco, migrador, app);
            assertThatThrownBy(() -> Flyway.configure().dataSource(urlDe(banco), migrador, SENHA_MIGRADOR).locations("classpath:db/migration")
                    .placeholders(Map.of("papelApp", "papel_que_nao_existe_" + sufixo)).load().migrate())
                    .hasMessageContaining("papel_que_nao_existe_");
        } finally {
            limpar(banco, migrador, app);
        }
    }
}
