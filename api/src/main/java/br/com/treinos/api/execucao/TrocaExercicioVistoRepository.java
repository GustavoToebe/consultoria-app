package br.com.treinos.api.execucao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Os "Visto" das trocas de exercício. Já filtrados pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface TrocaExercicioVistoRepository extends JpaRepository<TrocaExercicioVisto, UUID> {

    @Query("select v from TrocaExercicioVisto v where v.alunoId in :alunoIds and v.data between :de and :ate")
    List<TrocaExercicioVisto> doPeriodo(Collection<UUID> alunoIds, LocalDate de, LocalDate ate);

    @Query("select v from TrocaExercicioVisto v where v.alunoId = :alunoId and v.data = :data "
            + "and v.planoVersaoId = :planoVersaoId and v.exercicioUid = :exercicioUid and v.alternativaId = :alternativaId")
    Optional<TrocaExercicioVisto> daTroca(UUID alunoId, LocalDate data, UUID planoVersaoId, UUID exercicioUid, UUID alternativaId);
}
