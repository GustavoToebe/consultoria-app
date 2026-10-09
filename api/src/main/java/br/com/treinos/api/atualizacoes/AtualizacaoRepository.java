package br.com.treinos.api.atualizacoes;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
public interface AtualizacaoRepository extends JpaRepository<Atualizacao, UUID> {
    Optional<Atualizacao> findByPastaId(UUID pastaId);
    List<Atualizacao> findByAlunoIdOrderByDataAtualizacaoDesc(UUID alunoId);
    List<Atualizacao> findAllByOrderByDataAtualizacaoDesc();
    /** Sem "versioned": ler o feedback não pode dar 409 a quem está editando o texto. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Atualizacao a set a.feedbackVistoEm = :quando where a.id = :id and a.alunoId = :alunoId "
            + "and a.feedbackEm is not null and a.feedbackVistoEm is null")
    int marcarFeedbackVisto(UUID id, UUID alunoId, Instant quando);
}
