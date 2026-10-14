package br.com.treinos.api.privacidade;

import org.springframework.jdbc.core.JdbcTemplate;
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

    AnonimizacaoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
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
}
