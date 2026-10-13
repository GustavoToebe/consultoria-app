package br.com.treinos.api.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V024 sobre um banco já usado: Postgres próprio, migrado até a V023 com atualizações dentro, depois até o fim.
 * Dados fictícios.
 */
class QuestionarioMigrationIntegrationTest {

    @Test
    void migraAtualizacoesExistentesParaOQuestionarioPadrao() {
        try (var pg = new PostgreSQLContainer<>("postgres:17-alpine")
                .withDatabaseName("migracao").withUsername("migracao").withPassword("migracao")) {
            pg.start();
            var dataSource = new DriverManagerDataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
            Flyway ate23 = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("23").load();
            ate23.migrate();
            var banco = new JdbcTemplate(dataSource);

            UUID consultoria = UUID.randomUUID();
            UUID aluno = UUID.randomUUID();
            UUID pastaEnviada = UUID.randomUUID();
            UUID pastaAberta = UUID.randomUUID();
            banco.update("insert into consultoria(id, nome, slug) values (?, 'Consultoria fictícia', 'ficticia')", consultoria);
            banco.update("insert into aluno(id, consultoria_id, nome) values (?, ?, 'Aluno fictício')", aluno, consultoria);
            for (UUID pasta : new UUID[] {pastaEnviada, pastaAberta}) {
                banco.update("insert into pasta_plano(id, consultoria_id, aluno_id, titulo) values (?, ?, ?, 'Pasta')",
                        pasta, consultoria, aluno);
            }
            banco.update("insert into atualizacao(id, consultoria_id, aluno_id, pasta_id, data_atualizacao, modelo_versao, estado,"
                    + " respostas, enviada_em) values (?, ?, ?, ?, current_date, 1, 'ENVIADA', '{\"peso\": 80}', now())",
                    UUID.randomUUID(), consultoria, aluno, pastaEnviada);
            banco.update("insert into atualizacao(id, consultoria_id, aluno_id, pasta_id, data_atualizacao, modelo_versao, estado)"
                    + " values (?, ?, ?, ?, current_date, 1, 'ABERTA')", UUID.randomUUID(), consultoria, aluno, pastaAberta);

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

            // Consultoria que já existia ganhou o padrão publicado (v1) com o conteúdo no formato novo.
            assertThat(banco.queryForObject(
                    "select count(*) from questionario where consultoria_id = ? and padrao and versao_publicada = 1 and not arquivado",
                    Integer.class, consultoria)).isEqualTo(1);
            assertThat(banco.queryForObject(
                    "select v.conteudo->>'formato' from questionario_versao v join questionario q on q.id = v.questionario_id"
                            + " where q.consultoria_id = ? and q.padrao", String.class, consultoria)).isEqualTo("2");
            assertThat(banco.queryForObject(
                    "select v.conteudo->'secoes'->0->>'uid' from questionario_versao v where v.consultoria_id = ?",
                    String.class, consultoria)).isEqualTo("secao-1");
            assertThat(banco.queryForObject(
                    "select count(*) from questionario_versao v, jsonb_array_elements(v.conteudo->'secoes') s,"
                            + " jsonb_array_elements(s->'perguntas') p where v.consultoria_id = ? and p->>'id' = 'treino_dias'"
                            + " and p->>'ajudaAutomatica' = 'MEDIA_DIAS_TREINO'", Integer.class, consultoria)).isEqualTo(1);

            // Enviada passa a apontar para a v1 do padrão; aberta fica sem versão (vale a vigente na hora).
            assertThat(banco.queryForObject(
                    "select questionario_versao_id from atualizacao where pasta_id = ?", UUID.class, pastaEnviada))
                    .isEqualTo(banco.queryForObject("select id from questionario_versao where consultoria_id = ?", UUID.class, consultoria));
            assertThat(banco.queryForObject(
                    "select questionario_versao_id from atualizacao where pasta_id = ?", UUID.class, pastaAberta)).isNull();
            assertThat(banco.queryForObject(
                    "select count(*) from information_schema.columns where table_name = 'atualizacao' and column_name = 'modelo_versao'",
                    Integer.class)).isZero();

            // Enviada sem versão é recusada pelo banco.
            assertThatThrownBy(() -> banco.update("update atualizacao set questionario_versao_id = null where pasta_id = ?", pastaEnviada))
                    .isInstanceOf(DataIntegrityViolationException.class);
            // Versão publicada é imutável.
            assertThatThrownBy(() -> banco.update("update questionario_versao set conteudo = '{}'::jsonb where consultoria_id = ?", consultoria))
                    .isInstanceOf(DataIntegrityViolationException.class);
            // Só um padrão por consultoria.
            assertThatThrownBy(() -> banco.update(
                    "insert into questionario(id, consultoria_id, nome, padrao, rascunho, versao_publicada) values (?, ?, 'Outro', true, '{}'::jsonb, 1)",
                    UUID.randomUUID(), consultoria)).isInstanceOf(DataIntegrityViolationException.class);

            // Consultoria nova (cadastro depois da migration) também nasce com o padrão, por trigger.
            UUID nova = UUID.randomUUID();
            banco.update("insert into consultoria(id, nome, slug) values (?, 'Nova fictícia', 'nova-ficticia')", nova);
            assertThat(banco.queryForObject(
                    "select count(*) from questionario q join questionario_versao v on v.questionario_id = q.id and v.numero = q.versao_publicada"
                            + " where q.consultoria_id = ? and q.padrao", Integer.class, nova)).isEqualTo(1);
        }
    }
}
