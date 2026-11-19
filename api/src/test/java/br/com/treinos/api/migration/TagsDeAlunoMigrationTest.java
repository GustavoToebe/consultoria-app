package br.com.treinos.api.migration;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.web.Buscas;
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
 * V093 sobre dados da V092: {@code tag_aluno} recusa o mesmo nome sem caixa nem acento na consultoria (e aceita em outra), nome vazio
 * ou acima de 30, cor fora da lista fechada; {@code aluno_tag} recusa a mesma tag duas vezes no aluno, aluno ou tag de outra
 * consultoria (FKs compostas) e some junto com o aluno ou com a tag (ON DELETE CASCADE), sem apagar o resto. Usa outro banco na
 * mesma instância, migrado até a V092. Só dados fictícios.
 */
class TagsDeAlunoMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee93");
    private static final UUID OUTRA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee94");
    private static final UUID ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa93");
    private static final UUID OUTRO_ALUNO = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa94");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void unicidadeSemCaixaNemAcentoCoresFkCompostaECascade() throws Exception {
        String banco = "v093_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("92").load().migrate();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID consultoria : new UUID[]{CONSULTORIA, OUTRA}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + consultoria + "', 'Consultoria fictícia V093', 'v093-"
                            + consultoria + "')");
                }
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + ALUNO + "', '" + CONSULTORIA + "', 'Aluno fictício')");
                st.execute("insert into aluno(id, consultoria_id, nome) values ('" + OUTRO_ALUNO + "', '" + CONSULTORIA
                        + "', 'Outro aluno fictício')");

                assertThat(flyway(banco).target("93").load().migrate().migrationsExecuted).isEqualTo(1);

                UUID retorno = UUID.randomUUID();
                UUID online = UUID.randomUUID();
                st.execute(tag(retorno, CONSULTORIA, "Retorno", "AZUL"));
                st.execute(tag(online, CONSULTORIA, "Online", "VIOLETA"));
                // O normalizado é o do Java (Buscas.semAcento): "Avaliação  Física" e "avaliacao fisica" são a mesma tag.
                st.execute(tag(UUID.randomUUID(), CONSULTORIA, "Avaliação  Física", "CIANO"));
                assertThatThrownBy(() -> st.execute(tag(UUID.randomUUID(), CONSULTORIA, "avaliacao fisica", "AZUL")))
                        .hasMessageContaining("ux_tag_aluno_nome");
                assertThatThrownBy(() -> st.execute(tag(UUID.randomUUID(), CONSULTORIA, "RETORNO", "AZUL")))
                        .hasMessageContaining("ux_tag_aluno_nome");
                // O mesmo nome em outra consultoria vale.
                st.execute(tag(UUID.randomUUID(), OUTRA, "Retorno", "AZUL"));
                assertThat(contar(c, "select count(*) from tag_aluno where nome_normalizado = 'retorno'")).isEqualTo(2);
                // Cor fora da lista (a da marca e as de situação não entram), nome vazio e acima de 30.
                for (String cor : new String[]{"MARCA", "VERDE", "VERMELHO", "azul"}) {
                    assertThatThrownBy(() -> st.execute(tag(UUID.randomUUID(), CONSULTORIA, "Cor " + cor, cor)))
                            .hasMessageContaining("ck_tag_aluno_cor");
                }
                assertThatThrownBy(() -> st.execute(tag(UUID.randomUUID(), CONSULTORIA, "", "AZUL")))
                        .hasMessageContaining("ck_tag_aluno_nome");
                assertThatThrownBy(() -> st.execute(tag(UUID.randomUUID(), CONSULTORIA, "N".repeat(31), "AZUL")))
                        .hasMessageContaining("character varying(30)");

                // Ligação: uma vez por (aluno, tag); aluno ou tag de outra consultoria é recusado pelas FKs compostas.
                st.execute(ligacao(CONSULTORIA, ALUNO, retorno));
                st.execute(ligacao(CONSULTORIA, ALUNO, online));
                st.execute(ligacao(CONSULTORIA, OUTRO_ALUNO, retorno));
                assertThatThrownBy(() -> st.execute(ligacao(CONSULTORIA, ALUNO, retorno))).hasMessageContaining("pk_aluno_tag");
                UUID tagDeOutra = UUID.randomUUID();
                st.execute(tag(tagDeOutra, OUTRA, "Só da outra", "INDIGO"));
                assertThatThrownBy(() -> st.execute(ligacao(OUTRA, ALUNO, tagDeOutra))).hasMessageContaining("fk_aluno_tag_aluno");
                assertThatThrownBy(() -> st.execute(ligacao(CONSULTORIA, OUTRO_ALUNO, tagDeOutra)))
                        .hasMessageContaining("fk_aluno_tag_tag");
                assertThat(contar(c, "select count(*) from information_schema.columns where table_name = 'tag_aluno'"
                        + " and column_name = 'versao' and is_nullable = 'NO'")).isEqualTo(1);

                // Apagar a tag a tira de todos os alunos; apagar o aluno tira só as dele; a tag fica.
                st.execute("delete from tag_aluno where id = '" + online + "'");
                assertThat(contar(c, "select count(*) from aluno_tag where tag_id = '" + online + "'")).isZero();
                assertThat(contar(c, "select count(*) from aluno_tag where tag_id = '" + retorno + "'")).isEqualTo(2);
                st.execute("delete from aluno where id = '" + ALUNO + "'");
                assertThat(contar(c, "select count(*) from aluno_tag where aluno_id = '" + ALUNO + "'")).isZero();
                assertThat(contar(c, "select count(*) from aluno_tag where aluno_id = '" + OUTRO_ALUNO + "'")).isEqualTo(1);
                assertThat(contar(c, "select count(*) from tag_aluno where id = '" + retorno + "'")).isEqualTo(1);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    /** Insere com o nome normalizado calculado como o serviço: {@link Buscas#semAcento}. */
    private static String tag(UUID id, UUID consultoria, String nome, String cor) {
        return "insert into tag_aluno(id, consultoria_id, nome, nome_normalizado, cor) values ('" + id + "', '" + consultoria + "', '"
                + nome + "', '" + Buscas.semAcento(nome) + "', '" + cor + "')";
    }

    private static String ligacao(UUID consultoria, UUID aluno, UUID tag) {
        return "insert into aluno_tag(consultoria_id, aluno_id, tag_id) values ('" + consultoria + "', '" + aluno + "', '" + tag + "')";
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
