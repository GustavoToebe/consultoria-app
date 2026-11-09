package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V067: o link público passa a ter uma fonte só (o questionário de inscrição). Este teste usa outro banco na mesma
 * instância: migra até a V066 (estado de produção depois da V064), grava a configuração antiga do link (com texto de
 * privacidade e campos escondidos, que a V064 não copiou), um código sequestrado e uma anamnese pública, e só então aplica
 * a V067. Só dados fictícios.
 */
class LinkPublicoNoQuestionarioMigrationTest extends AbstractIntegrationTest {

    private static final String RASCUNHO = "'{\"formato\":2,\"instrucoes\":[],\"secoes\":[]}'::jsonb";
    private static final UUID A = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1");
    private static final UUID B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2");
    private static final UUID C = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3");
    private static final String SEQUESTRADA = "bbbbbbbb-0000-0000-0000-000000000001";
    private static final String ANAMNESE = "bbbbbbbb-0000-0000-0000-000000000002";
    private static final String PROXIMO_ERRADO = "bbbbbbbb-0000-0000-0000-000000000003";
    private static final String FECHADA_FRACA = "bbbbbbbb-0000-0000-0000-000000000004";
    private static final String CODIGO_A = "LinkFicticioDaConsultoriaA01";
    private static final String CODIGO_B = "LinkFicticioDaConsultoriaB01";
    private static final String TEXTO_A = "Texto fictício de privacidade da consultoria A.";

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void sincronizaOLinkCopiaTextoECamposSemSobrescreverELimpaOQueNaoEDeInscricao() throws Exception {
        String banco = "v067_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("66").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID id : new UUID[] {A, B, C}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + id + "', 'Consultoria fictícia V067', 'v067-"
                            + id.toString().substring(30) + "-" + banco + "')");
                }
                // O cartão "Link" (inscricao_configuracao) era o controle de verdade; A tem texto e campos escondidos.
                st.execute("insert into inscricao_configuracao(id, consultoria_id, codigo, aberta, texto, campos_ocultos) values "
                        + "(gen_random_uuid(), '" + A + "', '" + CODIGO_A + "', true, '" + TEXTO_A + "', 'EMAIL,SEXO')");
                st.execute("insert into inscricao_configuracao(id, consultoria_id, codigo, aberta) values "
                        + "(gen_random_uuid(), '" + B + "', '" + CODIGO_B + "', false)");
                String padraoB = escalar(c, "select id::text from questionario where consultoria_id = '" + B
                        + "' and finalidade = 'INSCRICAO' and padrao");
                // Código de A preso num formulário de B (o salvar da V064 aceitava código do cliente), uma anamnese pública
                // encadeada e um formulário de inscrição cujo "próximo" não é de inscrição.
                st.execute("insert into questionario(id, consultoria_id, nome, finalidade, rascunho, codigo_publico, publico_aberto) "
                        + "values ('" + SEQUESTRADA + "', '" + B + "', 'Inscrição sequestrada fictícia', 'INSCRICAO', "
                        + RASCUNHO + ", '" + CODIGO_A + "', true)");
                st.execute("insert into questionario(id, consultoria_id, nome, finalidade, rascunho, codigo_publico, publico_aberto,"
                        + " proximo_questionario_id) values ('" + ANAMNESE + "', '" + B
                        + "', 'Anamnese pública fictícia', 'ANAMNESE', " + RASCUNHO + ", 'AnamnesePublicaFicticia001', true, '"
                        + padraoB + "')");
                st.execute("insert into questionario(id, consultoria_id, nome, finalidade, rascunho, proximo_questionario_id) "
                        + "values ('" + PROXIMO_ERRADO + "', '" + B + "', 'Inscrição com próximo errado fictícia', "
                        + "'INSCRICAO', " + RASCUNHO + ", '" + ANAMNESE + "')");
                // Inscrição fechada com código fraco (16 caracteres, de antes) que não está no cartão antigo.
                st.execute("insert into questionario(id, consultoria_id, nome, finalidade, rascunho, codigo_publico, publico_aberto) "
                        + "values ('" + FECHADA_FRACA + "', '" + B + "', 'Inscrição fechada com código fraco fictícia', "
                        + "'INSCRICAO', " + RASCUNHO + ", 'CodigoFracoFicti01', false)");

                assertThat(flyway(banco).target("67").load().migrate().migrationsExecuted).isEqualTo(1);

                // A: código, abertura, texto de privacidade (que torna a ciência obrigatória) e campos escondidos vieram junto.
                assertThat(linha(c, A)).containsExactly(CODIGO_A, "true", TEXTO_A, "EMAIL,SEXO", "0");
                // B: o link desligado no cartão continua desligado e sem texto.
                assertThat(linha(c, B)).containsExactly(CODIGO_B, "false", null, "", "0");
                // C não tinha configuração: link fechado e o código fraco da V064 sai (abrir gera um novo no servidor).
                assertThat(linha(c, C)).containsExactly(null, "false", null, "", "0");
                // Fechado e fora do cartão antigo: código descartado.
                assertThat(escalar(c, "select codigo_publico from questionario where id = '" + FECHADA_FRACA + "'")).isNull();
                // O código preso no formulário errado de B foi solto; só o padrão de A o tem.
                assertThat(escalar(c, "select codigo_publico from questionario where id = '" + SEQUESTRADA + "'")).isNull();
                assertThat(escalar(c, "select count(*) from questionario where codigo_publico = '" + CODIGO_A + "'")).isEqualTo("1");
                // Anamnese não tem link público nem encadeamento.
                assertThat(escalar(c, "select coalesce(codigo_publico, 'nulo') || '/' || publico_aberto || '/' || "
                        + "coalesce(proximo_questionario_id::text, 'nulo') from questionario where id = '" + ANAMNESE + "'"))
                        .isEqualTo("nulo/false/nulo");
                // O próximo de um formulário de inscrição é sempre outro formulário de inscrição.
                assertThat(escalar(c, "select coalesce(proximo_questionario_id::text, 'nulo') from questionario where id = '"
                        + PROXIMO_ERRADO + "'")).isEqualTo("nulo");
                // A tabela antiga fica como está (sai numa migration própria, depois de conferida em produção).
                assertThat(escalar(c, "select count(*) from inscricao_configuracao")).isEqualTo("2");

                // A regra agora é do banco: anamnese com código não entra mais, e campos escondidos têm formato.
                assertThatThrownBy(() -> st.execute("update questionario set codigo_publico = 'AnamneseOutroCodigoFicticio01' "
                        + "where id = '" + ANAMNESE + "'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("ck_questionario_link_so_inscricao");
                assertThatThrownBy(() -> st.execute("update questionario set campos_ocultos = 'nome' where id = '" + padraoB + "'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("ck_questionario_campos_ocultos");

                // Repetir a migration não sobrescreve nada que o treinador já editou depois.
                st.execute("update questionario set texto_apresentacao = 'Texto já editado fictício', campos_ocultos = 'ORIGEM' "
                        + "where consultoria_id = '" + A + "' and finalidade = 'INSCRICAO' and padrao");
                st.execute(new String(new ClassPathResource("db/migration/V067__link_publico_so_no_questionario.sql")
                        .getInputStream().readAllBytes(), StandardCharsets.UTF_8));
                assertThat(linha(c, A)).containsExactly(CODIGO_A, "true", "Texto já editado fictício", "ORIGEM", "0");
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    /**
     * Código, aberto, texto, campos escondidos e versão do link do formulário de inscrição padrão da consultoria. Antes da
     * V067 as duas últimas colunas não existem: só a primeira é lida nesse estado.
     */
    private static List<String> linha(Connection c, UUID consultoria) throws SQLException {
        boolean comLink = false;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "select count(*) from information_schema.columns where table_name = 'questionario' and column_name = 'link_versao'")) {
            rs.next();
            comLink = rs.getInt(1) == 1;
        }
        String colunas = comLink ? "codigo_publico, publico_aberto, texto_apresentacao, campos_ocultos, link_versao"
                : "codigo_publico, publico_aberto, null, null, null";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select " + colunas
                + " from questionario where consultoria_id = '" + consultoria + "' and finalidade = 'INSCRICAO' and padrao")) {
            assertThat(rs.next()).isTrue();
            // Arrays.asList aceita nulo (List.of não).
            return Arrays.asList(rs.getString(1), String.valueOf(rs.getBoolean(2)), rs.getString(3), rs.getString(4), rs.getString(5));
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
