package br.com.treinos.api.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V025 sobre um banco já usado: Postgres próprio, migrado até a V024 com consultorias dentro, depois até o fim.
 * Perfis padrão são localizados pelo id determinístico, nunca pelo nome. Dados fictícios.
 */
class PermissoesQuestionarioMigrationIntegrationTest {

    private static final String LER = "QUESTIONARIO_LER";
    private static final String ALTERAR = "QUESTIONARIO_ALTERAR";

    private static Set<String> permissoes(JdbcTemplate banco, UUID consultoria, String perfil) {
        return new HashSet<>(banco.queryForList(
                "select pp.codigo from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                        + " where p.consultoria_id = ? and p.nome = ?", String.class, consultoria, perfil));
    }

    private static Set<String> mais(Set<String> base, String... extras) {
        Set<String> r = new HashSet<>(base);
        r.addAll(Set.of(extras));
        return r;
    }

    @Test
    void perfisExistentesGanhamOQueFaltaENovasConsultoriasNascemCompletas() {
        try (var pg = new PostgreSQLContainer<>("postgres:17-alpine")
                .withDatabaseName("migracao").withUsername("migracao").withPassword("migracao")) {
            pg.start();
            var dataSource = new DriverManagerDataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("24").load().migrate();
            var banco = new JdbcTemplate(dataSource);

            UUID inteira = UUID.randomUUID();
            UUID semAssistente = UUID.randomUUID();
            UUID editada = UUID.randomUUID();
            for (UUID c : new UUID[] {inteira, semAssistente, editada}) {
                banco.update("insert into consultoria(id, nome, slug) values (?, 'Consultoria fictícia', ?)", c,
                        "c-" + c);
            }
            // O dono apagou o Assistente de uma e tirou uma permissão do Treinador de outra.
            banco.update("delete from perfil_permissao where perfil_id = md5(?::text || ':Assistente')::uuid", semAssistente);
            banco.update("delete from perfil where id = md5(?::text || ':Assistente')::uuid", semAssistente);
            banco.update("delete from perfil_permissao where perfil_id = md5(?::text || ':Treinador')::uuid"
                    + " and codigo = 'MODELO_APLICAR'", editada);

            Set<String> treinadorAntes = permissoes(banco, inteira, "Treinador");
            Set<String> nutricionistaAntes = permissoes(banco, inteira, "Nutricionista");
            Set<String> assistenteAntes = permissoes(banco, inteira, "Assistente");
            Set<String> editadaAntes = permissoes(banco, editada, "Treinador");
            assertThat(treinadorAntes).doesNotContain(LER, ALTERAR);

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

            // Existentes: só ganham as permissões novas, sem perder nem trocar nada.
            assertThat(permissoes(banco, inteira, "Treinador")).isEqualTo(mais(treinadorAntes, LER, ALTERAR));
            assertThat(permissoes(banco, inteira, "Nutricionista")).isEqualTo(mais(nutricionistaAntes, LER, ALTERAR));
            assertThat(permissoes(banco, inteira, "Assistente")).isEqualTo(mais(assistenteAntes, LER));
            assertThat(permissoes(banco, inteira, "Administrador")).isEmpty();
            assertThat(permissoes(banco, editada, "Treinador")).isEqualTo(mais(editadaAntes, LER, ALTERAR))
                    .doesNotContain("MODELO_APLICAR");
            // Perfil apagado continua apagado e não deixa permissão solta.
            assertThat(banco.queryForObject("select count(*) from perfil where consultoria_id = ? and nome = 'Assistente'",
                    Integer.class, semAssistente)).isZero();
            assertThat(banco.queryForObject("select count(*) from perfil_permissao pp where pp.codigo in (?, ?)"
                    + " and not exists (select 1 from perfil p where p.id = pp.perfil_id)", Integer.class, LER, ALTERAR))
                    .isZero();

            // Consultoria nova: a função recriada mantém tudo que as antigas tinham, mais as novas.
            UUID nova = UUID.randomUUID();
            banco.update("insert into consultoria(id, nome, slug) values (?, 'Consultoria nova fictícia', ?)", nova,
                    "c-" + nova);
            assertThat(permissoes(banco, nova, "Treinador")).isEqualTo(mais(treinadorAntes, LER, ALTERAR));
            assertThat(permissoes(banco, nova, "Nutricionista")).isEqualTo(mais(nutricionistaAntes, LER, ALTERAR));
            assertThat(permissoes(banco, nova, "Assistente")).isEqualTo(mais(assistenteAntes, LER));
            assertThat(permissoes(banco, nova, "Assistente")).noneMatch(c -> c.contains("SENSIVEL") || c.startsWith("ATUALIZACAO_"));
            assertThat(banco.queryForObject("select count(*) from perfil where consultoria_id = ?", Integer.class, nova))
                    .isEqualTo(4);
        }
    }
}
