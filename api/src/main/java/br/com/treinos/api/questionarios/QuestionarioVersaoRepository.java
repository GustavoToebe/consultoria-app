package br.com.treinos.api.questionarios;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QuestionarioVersaoRepository extends JpaRepository<QuestionarioVersao, UUID> {
    Optional<QuestionarioVersao> findByQuestionarioIdAndNumero(UUID questionarioId, int numero);

    List<QuestionarioVersao> findByQuestionarioIdOrderByNumeroAsc(UUID questionarioId);
}
