package br.com.treinos.api.privacidade;

import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * SQL nativo da anonimização, permitido no {@code ArquiteturaTest}: o que se limpa aqui é imutável pela JPA
 * ({@code ExecucaoSerie} é {@code @Immutable}; títulos de versão publicada têm {@code updatable = false}), e o
 * {@code @TenantId} não protege SQL nativo. Todo método filtra {@code consultoria_id} e {@code aluno_id} à mão.
 */
@Component
class AnonimizacaoRepositorio {

    static final String TITULO_DO_PLANO = "Plano anonimizado";
    static final String TITULO_DA_PASTA = "Pasta anonimizada";

    private final JdbcTemplate jdbc;
    private final JsonMapper json;

    AnonimizacaoRepositorio(JdbcTemplate jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** A observação da série é texto livre do aluno (dado sensível); carga, repetições e datas ficam. */
    void apagarObservacoesDasExecucoes(UUID consultoriaId, UUID alunoId) {
        jdbc.update("update execucao_serie set observacao = null where consultoria_id = ? and aluno_id = ?",
                consultoriaId, alunoId);
    }

    /**
     * O app sugere "Treino de nome" como título, então o nome da pessoa fica gravado nos títulos de planos, versões e
     * pastas. O conteúdo dos treinos (exercícios) e as datas ficam, para as contagens.
     */
    void apagarNomesDosTitulos(UUID consultoriaId, UUID alunoId) {
        jdbc.update("update plano_treino_versao set titulo = ? where consultoria_id = ? and plano_id in "
                + "(select id from plano_treino where consultoria_id = ? and aluno_id = ?)",
                TITULO_DO_PLANO, consultoriaId, consultoriaId, alunoId);
        jdbc.update("update plano_treino set titulo = ? where consultoria_id = ? and aluno_id = ?",
                TITULO_DO_PLANO, consultoriaId, alunoId);
        jdbc.update("update plano_mobilidade_versao set titulo = ? where consultoria_id = ? and plano_id in "
                + "(select id from plano_mobilidade where consultoria_id = ? and aluno_id = ?)",
                TITULO_DO_PLANO, consultoriaId, consultoriaId, alunoId);
        jdbc.update("update plano_mobilidade set titulo = ? where consultoria_id = ? and aluno_id = ?",
                TITULO_DO_PLANO, consultoriaId, alunoId);
        jdbc.update("update pasta_plano set titulo = ? where consultoria_id = ? and aluno_id = ?",
                TITULO_DA_PASTA, consultoriaId, alunoId);
    }

    /**
     * Texto livre dentro dos planos de treino e de mobilidade do aluno, no rascunho e em toda versão publicada
     * ({@link TextoLivreDosPlanos}). O conteúdo é JSON e a versão é imutável pela JPA, então a limpeza é aqui; as linhas
     * saem sempre de {@code consultoria_id} e {@code aluno_id} (a versão, pelo plano do aluno).
     */
    void apagarTextoLivreDosPlanos(UUID consultoriaId, UUID alunoId) {
        for (String plano : new String[] {"plano_treino", "plano_mobilidade"}) {
            limparConteudo("select id, rascunho::text from " + plano + " where consultoria_id = ? and aluno_id = ?",
                    "update " + plano + " set rascunho = ?::jsonb where consultoria_id = ? and id = ?", consultoriaId, alunoId);
            limparConteudo("select id, conteudo::text from " + plano + "_versao where consultoria_id = ? and plano_id in "
                            + "(select id from " + plano + " where consultoria_id = ? and aluno_id = ?)",
                    "update " + plano + "_versao set conteudo = ?::jsonb where consultoria_id = ? and id = ?",
                    consultoriaId, consultoriaId, alunoId);
        }
    }

    private void limparConteudo(String consulta, String atualizacao, Object... parametros) {
        UUID consultoriaId = (UUID) parametros[0];
        var linhas = jdbc.query(consulta, (rs, n) -> new Object[] {rs.getObject(1, UUID.class), rs.getString(2)}, parametros);
        for (Object[] linha : linhas) {
            String limpo = json.writeValueAsString(TextoLivreDosPlanos.limpar(json.readTree((String) linha[1])));
            jdbc.update(atualizacao, limpo, consultoriaId, linha[0]);
        }
    }
}
