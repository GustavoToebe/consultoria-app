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
 * V099 sobre dados da V098: itens que já existiam nascem sem categoria; {@code vitrine_categoria} recusa o mesmo nome sem caixa nem
 * acento na consultoria (e aceita em outra), nome vazio ou acima de 40 e ordem negativa; {@code vitrine_item.categoria_id} só aceita
 * categoria da própria consultoria (FK composta) e, ao excluir a categoria, volta a nulo sem apagar o item nem tocar em
 * {@code consultoria_id} nem nos itens das outras categorias. Usa outro banco na mesma instância, migrado até a V098. Só dados fictícios.
 */
class VitrineCategoriasMigrationTest extends AbstractIntegrationTest {

    private static final UUID CONSULTORIA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee99");
    private static final UUID OUTRA = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee98");

    @Value("${spring.datasource.url}") String urlPadrao;
    @Value("${spring.datasource.username}") String usuarioAdmin;
    @Value("${spring.datasource.password}") String senhaAdmin;

    @Test
    void unicidadeSemCaixaNemAcentoFkCompostaESetNullSoDaCategoria() throws Exception {
        String banco = "v099_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try {
            admin("postgres", "CREATE DATABASE " + banco);
            flyway(banco).target("98").load().migrate();
            UUID itemAntigo = UUID.randomUUID();
            try (Connection c = DriverManager.getConnection(urlDe(banco), usuarioAdmin, senhaAdmin); Statement st = c.createStatement()) {
                for (UUID consultoria : new UUID[]{CONSULTORIA, OUTRA}) {
                    st.execute("insert into consultoria(id, nome, slug) values ('" + consultoria + "', 'Consultoria fictícia V099', 'v099-"
                            + consultoria + "')");
                }
                st.execute(item(itemAntigo, CONSULTORIA, 0));

                assertThat(flyway(banco).target("99").load().migrate().migrationsExecuted).isEqualTo(1);

                // O item que já existia nasce sem categoria.
                assertThat(contar(c, "select count(*) from vitrine_item where id = '" + itemAntigo + "' and categoria_id is null")).isEqualTo(1);

                UUID livros = UUID.randomUUID();
                UUID videos = UUID.randomUUID();
                st.execute(categoria(livros, CONSULTORIA, "Livros", 0));
                st.execute(categoria(videos, CONSULTORIA, "Vídeo  Aulas", 1));
                // O normalizado é o do Java (Buscas.semAcento): "Vídeo  Aulas" e "video aulas" são a mesma categoria.
                assertThatThrownBy(() -> st.execute(categoria(UUID.randomUUID(), CONSULTORIA, "video aulas", 2)))
                        .hasMessageContaining("ux_vitrine_categoria_nome");
                assertThatThrownBy(() -> st.execute(categoria(UUID.randomUUID(), CONSULTORIA, "LIVROS", 2)))
                        .hasMessageContaining("ux_vitrine_categoria_nome");
                // O mesmo nome em outra consultoria vale.
                UUID livrosDaOutra = UUID.randomUUID();
                st.execute(categoria(livrosDaOutra, OUTRA, "Livros", 0));
                assertThat(contar(c, "select count(*) from vitrine_categoria where nome_normalizado = 'livros'")).isEqualTo(2);
                // Nome vazio, acima de 40 e ordem negativa.
                assertThatThrownBy(() -> st.execute(categoria(UUID.randomUUID(), CONSULTORIA, "", 2)))
                        .hasMessageContaining("ck_vitrine_categoria_nome");
                assertThatThrownBy(() -> st.execute(categoria(UUID.randomUUID(), CONSULTORIA, "N".repeat(41), 2)))
                        .hasMessageContaining("character varying(40)");
                assertThatThrownBy(() -> st.execute(categoria(UUID.randomUUID(), CONSULTORIA, "Ordem negativa", -1)))
                        .hasMessageContaining("ck_vitrine_categoria_ordem");

                // Item só aceita categoria da própria consultoria (FK composta); nulo é livre.
                UUID emLivros = UUID.randomUUID();
                UUID emVideos = UUID.randomUUID();
                UUID semCategoria = UUID.randomUUID();
                UUID daOutra = UUID.randomUUID();
                st.execute(item(emLivros, CONSULTORIA, 1));
                st.execute("update vitrine_item set categoria_id = '" + livros + "' where id = '" + emLivros + "'");
                st.execute(item(emVideos, CONSULTORIA, 2));
                st.execute("update vitrine_item set categoria_id = '" + videos + "' where id = '" + emVideos + "'");
                st.execute(item(semCategoria, CONSULTORIA, 3));
                st.execute(item(daOutra, OUTRA, 0));
                st.execute("update vitrine_item set categoria_id = '" + livrosDaOutra + "' where id = '" + daOutra + "'");
                assertThatThrownBy(() -> st.execute("update vitrine_item set categoria_id = '" + livrosDaOutra + "' where id = '" + emLivros + "'"))
                        .hasMessageContaining("fk_vitrine_item_categoria");

                // Excluir a categoria anula só a coluna dela: o item fica (com a consultoria), os outros não mudam.
                st.execute("delete from vitrine_categoria where id = '" + livros + "'");
                assertThat(contar(c, "select count(*) from vitrine_item where id = '" + emLivros + "' and categoria_id is null"
                        + " and consultoria_id = '" + CONSULTORIA + "'")).isEqualTo(1);
                assertThat(contar(c, "select count(*) from vitrine_item where id = '" + emVideos + "' and categoria_id = '" + videos + "'"))
                        .isEqualTo(1);
                assertThat(contar(c, "select count(*) from vitrine_item where id = '" + daOutra + "' and categoria_id = '" + livrosDaOutra + "'"))
                        .isEqualTo(1);
                assertThat(contar(c, "select count(*) from vitrine_item where consultoria_id = '" + CONSULTORIA + "'")).isEqualTo(4);
            }
        } finally {
            admin("postgres", "DROP DATABASE IF EXISTS " + banco + " WITH (FORCE)");
        }
    }

    /** Item mínimo; a V099 não mexe nas outras colunas (a V077 e a V079 deram os padrões das duas marcas). */
    private static String item(UUID id, UUID consultoria, int ordem) {
        return "insert into vitrine_item(id, consultoria_id, nome, tipo, ativo, ordem) values ('" + id + "', '" + consultoria
                + "', 'Item fictício', 'FISICO', true, " + ordem + ")";
    }

    /** Insere com o nome normalizado calculado como o serviço: {@link Buscas#semAcento}. */
    private static String categoria(UUID id, UUID consultoria, String nome, int ordem) {
        return "insert into vitrine_categoria(id, consultoria_id, nome, nome_normalizado, ordem) values ('" + id + "', '" + consultoria
                + "', '" + nome + "', '" + Buscas.semAcento(nome) + "', " + ordem + ")";
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
