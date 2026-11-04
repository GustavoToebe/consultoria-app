package br.com.treinos.api.questionarios;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O passo 2 da V058 (consultorias que já existiam): o Padrão que o treinador nunca mexeu ganha a versão 2 com o texto novo;
 * o que ele editou fica como está. O banco de teste nasce já com a fábrica nova, então aqui o Padrão é posto de volta no
 * texto antigo (a versão publicada é imutável por trigger de UPDATE; apagar e gravar de novo vale só neste teste) e o
 * trecho da migration roda de novo. Sem dado de aluno.
 */
@AutoConfigureMockMvc
class PadraoDoQuestionarioV058IntegrationTest extends AbstractIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private TransactionTemplate transacao;
    private UUID consultoria;
    private UUID padrao;

    @BeforeEach
    void preparar() throws Exception {
        String usuario = new ApiDeTeste(mvc, json).novoTreinador().path("usuario").path("id").asString();
        consultoria = banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, usuario);
        padrao = banco.queryForObject("select id from questionario where consultoria_id = ? and padrao and finalidade = 'ATUALIZACAO'",
                UUID.class, consultoria);
        // Padrão de uma consultoria antiga: versão 1 e rascunho com o conteúdo da fábrica 2.
        banco.update("delete from questionario_versao where questionario_id = ?", padrao);
        banco.update("insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo) "
                + "select gen_random_uuid(), ?, ?, 1, conteudo from atualizacao_modelo where versao = 2", consultoria, padrao);
        banco.update("update questionario set rascunho = (select conteudo from atualizacao_modelo where versao = 2), "
                + "versao_publicada = 1 where id = ?", padrao);
    }

    private void rodarPassoDasConsultoriasExistentes() throws IOException {
        String sql = new String(getClass().getResourceAsStream("/db/migration/V058__texto_do_questionario_e_fila_do_crm.sql").readAllBytes(),
                StandardCharsets.UTF_8);
        String passo = sql.substring(sql.indexOf("WITH alvo"), sql.indexOf("-- 3."));
        transacao.executeWithoutResult(s -> banco.execute(passo));
    }

    private String titulo(String tabela, String filtro) {
        return banco.queryForObject("select conteudo->'secoes'->0->>'titulo' from " + tabela + " where " + filtro, String.class);
    }

    @Test
    void padraoIntocadoGanhaAVersao2ComOTextoNovoEAVersao1FicaComoEra() throws IOException {
        rodarPassoDasConsultoriasExistentes();

        assertThat(banco.queryForObject("select versao_publicada from questionario where id = ?", Integer.class, padrao)).isEqualTo(2);
        assertThat(banco.queryForObject("select rascunho->'secoes'->0->>'titulo' from questionario where id = ?", String.class, padrao))
                .isEqualTo("Seu envio");
        assertThat(titulo("questionario_versao", "questionario_id = '" + padrao + "' and numero = 2")).isEqualTo("Seu envio");
        assertThat(titulo("questionario_versao", "questionario_id = '" + padrao + "' and numero = 1")).isEqualTo("Atualização");
        assertThat(banco.queryForObject("select conteudo->'secoes'->0->'perguntas'->0->>'rotulo' from questionario_versao "
                + "where questionario_id = ? and numero = 2", String.class, padrao)).isEqualTo("Data marcada");
    }

    @Test
    void padraoQueOTreinadorEditouFicaComoEstava() throws IOException {
        banco.update("update questionario set rascunho = jsonb_set(rascunho, '{secoes,0,titulo}', '\"Meu título\"') where id = ?", padrao);
        rodarPassoDasConsultoriasExistentes();

        assertThat(banco.queryForObject("select versao_publicada from questionario where id = ?", Integer.class, padrao)).isEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from questionario_versao where questionario_id = ?", Integer.class, padrao)).isEqualTo(1);
        assertThat(banco.queryForObject("select rascunho->'secoes'->0->>'titulo' from questionario where id = ?", String.class, padrao))
                .isEqualTo("Meu título");
    }
}
