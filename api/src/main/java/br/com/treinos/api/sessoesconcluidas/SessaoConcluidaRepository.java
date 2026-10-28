package br.com.treinos.api.sessoesconcluidas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Leituras das sessões concluídas. Já filtradas pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface SessaoConcluidaRepository extends JpaRepository<SessaoConcluida, UUID> {

    List<SessaoConcluida> findByAlunoIdAndSituacaoAndDataBetweenOrderByDataDescIdAsc(UUID alunoId, String situacao,
                                                                                     LocalDate de, LocalDate ate);

    /** Quantos registros do aluno estão concluídos, em todo o histórico (a consultoria sai do {@code @TenantId}). */
    long countByAlunoIdAndSituacaoAndConcluidaTrue(UUID alunoId, String situacao);
}
