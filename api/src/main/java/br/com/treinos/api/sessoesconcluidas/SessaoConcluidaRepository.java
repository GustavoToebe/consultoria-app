package br.com.treinos.api.sessoesconcluidas;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Leituras das sessões concluídas. Já filtradas pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface SessaoConcluidaRepository extends JpaRepository<SessaoConcluida, UUID> {

    List<SessaoConcluida> findByAlunoIdAndSituacaoAndDataBetweenOrderByDataDescIdAsc(UUID alunoId, String situacao,
                                                                                     LocalDate de, LocalDate ate);

    /** Quantos registros do aluno estão concluídos, em todo o histórico (a consultoria sai do {@code @TenantId}). */
    long countByAlunoIdAndSituacaoAndConcluidaTrue(UUID alunoId, String situacao);

    /** A sessão concluída com trava: marcar o "Visto" duas vezes ao mesmo tempo fica em série (e não duplica). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SessaoConcluida s where s.id = :id")
    Optional<SessaoConcluida> travar(UUID id);
}
