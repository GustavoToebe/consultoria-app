package br.com.treinos.api.questionarios;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QuestionarioRepository extends JpaRepository<Questionario, UUID> {
    Optional<Questionario> findByPadraoTrue();

    /** Trava a linha: publicar e trocar o padrão em paralelo esperam em fila e a segunda cai em CONFLITO_EDICAO. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from Questionario q where q.id = :id")
    Optional<Questionario> buscarParaAlterar(UUID id);

    boolean existsByNomeIgnoreCaseAndArquivadoFalse(String nome);

    boolean existsByNomeIgnoreCaseAndArquivadoFalseAndIdNot(String nome, UUID id);

    List<Questionario> findByArquivadoOrderByNomeAsc(boolean arquivado);

    /** Contagens para a lista (uma consulta por tipo de uso, sem N+1). Todas passam pelo @TenantId. */
    @Query("select new br.com.treinos.api.questionarios.ContagemPorQuestionario(a.questionarioId, count(a)) "
            + "from Aluno a where a.questionarioId is not null group by a.questionarioId")
    List<ContagemPorQuestionario> contarAlunos();

    @Query("select new br.com.treinos.api.questionarios.ContagemPorQuestionario(p.questionarioId, count(p)) "
            + "from PastaPlano p where p.questionarioId is not null group by p.questionarioId")
    List<ContagemPorQuestionario> contarPastas();

    @Query("select new br.com.treinos.api.questionarios.ContagemPorQuestionario(v.questionarioId, count(t)) "
            + "from Atualizacao t, QuestionarioVersao v where t.questionarioVersaoId = v.id group by v.questionarioId")
    List<ContagemPorQuestionario> contarEnvios();

    /** Quantos envios apontam para alguma versão deste questionário (impede excluir). */
    @Query("select count(t) from Atualizacao t, QuestionarioVersao v "
            + "where t.questionarioVersaoId = v.id and v.questionarioId = :id")
    long contarEnviosDo(UUID id);
}
