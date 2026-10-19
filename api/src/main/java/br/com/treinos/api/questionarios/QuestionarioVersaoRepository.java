package br.com.treinos.api.questionarios;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QuestionarioVersaoRepository extends JpaRepository<QuestionarioVersao, UUID> {
    Optional<QuestionarioVersao> findByQuestionarioIdAndNumero(UUID questionarioId, int numero);

    List<QuestionarioVersao> findByQuestionarioIdOrderByNumeroAsc(UUID questionarioId);

    /** Conteúdo de todas as versões publicadas da consultoria (para saber quais imagens ainda estão em uso). */
    @org.springframework.data.jpa.repository.Query("select v.conteudo from QuestionarioVersao v")
    List<String> conteudos();

    /** Conteúdo das versões dadas (as que o aluno respondeu ou responde), para conferir as imagens que ele pode ver. */
    @org.springframework.data.jpa.repository.Query("select v.conteudo from QuestionarioVersao v where v.id in :ids")
    List<String> conteudosDe(java.util.Collection<UUID> ids);
}
