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

    /** As tags do aluno (V093): só a ligação sai, a tag da consultoria fica para os outros alunos. O aluno não é apagado, então o cascade da FK não roda. */
    void apagarTagsDoAluno(UUID consultoriaId, UUID alunoId) {
        jdbc.update("delete from aluno_tag where consultoria_id = ? and aluno_id = ?", consultoriaId, alunoId);
    }

    /** A observação da série é texto livre do aluno (dado sensível); carga, repetições e datas ficam. */
    void apagarObservacoesDasExecucoes(UUID consultoriaId, UUID alunoId) {
        jdbc.update("update execucao_serie set observacao = null where consultoria_id = ? and aluno_id = ?",
                consultoriaId, alunoId);
    }

    /**
     * O comentário que o aluno escreveu ao concluir um treino é texto livre (dado sensível). A linha fica (feito, resultado,
     * duração e data não identificam ninguém e alimentam as contagens); só o texto sai. Roda com a chave do retorno ligada ou não.
     */
    void apagarComentariosDasSessoesConcluidas(UUID consultoriaId, UUID alunoId) {
        jdbc.update("update sessao_concluida set comentario = null where aluno_id = ? and consultoria_id = ?",
                alunoId, consultoriaId);
    }

    /**
     * Indicação de alunos (V081): as inscrições que este aluno indicou perdem o vínculo (a FK com {@code SET NULL} só age em DELETE
     * e a anonimização não apaga a linha) e o código do link dele é trocado por outro aleatório, então o link antigo que circula em
     * WhatsApp deixa de valer. As duas linhas saem sempre de {@code consultoria_id}; nada disso vai a log nem à auditoria.
     */
    void desfazerIndicacoes(UUID consultoriaId, UUID alunoId) {
        jdbc.update("update inscricao set indicado_por_aluno_id = null where consultoria_id = ? and indicado_por_aluno_id = ?",
                consultoriaId, alunoId);
        jdbc.update("update aluno set codigo_indicacao = gen_random_uuid() where consultoria_id = ? and id = ?",
                consultoriaId, alunoId);
    }

    /**
     * Comunidade (V065): o que o usuário do aluno escreveu sai do ar. Posts e comentários perdem texto, vídeo, busca, foto e nome
     * (o nome civil ficava gravado em {@code autor_nome}) e ficam ocultos; as reações e os votos de enquete dele são apagados. Uma linha vazia e oculta
     * preserva as contagens dos outros e a FK. As linhas saem de {@code consultoria_id} e do usuário do aluno
     * ({@code autor_id}/{@code usuario_id}, é o que a tabela guarda, não o {@code aluno_id}).
     */
    void anonimizarComunidade(UUID consultoriaId, UUID usuarioId, String nomeAnonimizado) {
        jdbc.update("update comunidade_mural_post set autor_nome = ?, autor_foto_url = null, texto = '', video_url = null, texto_busca = '', "
                + "oculto = true where consultoria_id = ? and autor_id = ?", nomeAnonimizado, consultoriaId, usuarioId);
        jdbc.update("update comunidade_mural_comentario set autor_nome = ?, autor_foto_url = null, texto = '', oculto = true "
                + "where consultoria_id = ? and autor_id = ?", nomeAnonimizado, consultoriaId, usuarioId);
        jdbc.update("update comunidade_aula_comentario set autor_nome = ?, autor_foto_url = null, texto = '', oculto = true "
                + "where consultoria_id = ? and autor_id = ?", nomeAnonimizado, consultoriaId, usuarioId);
        jdbc.update("delete from comunidade_mural_reacao where consultoria_id = ? and usuario_id = ?", consultoriaId, usuarioId);
        // Os votos identificados em enquetes (V072) saem junto: a opção e o horário dizem o que ele escolheu e quando.
        jdbc.update("delete from comunidade_enquete_voto where consultoria_id = ? and usuario_id = ?", consultoriaId, usuarioId);
        // Fotos que ele enviou (de post ou pendentes) e denúncias que ele fez saem do banco (V071); sempre com a consultoria.
        jdbc.update("delete from comunidade_mural_foto where consultoria_id = ? and autor_id = ?", consultoriaId, usuarioId);
        jdbc.update("delete from comunidade_mural_denuncia where consultoria_id = ? and usuario_id = ?", consultoriaId, usuarioId);
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
