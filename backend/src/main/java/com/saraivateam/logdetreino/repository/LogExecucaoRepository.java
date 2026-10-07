package com.saraivateam.logdetreino.repository;

import com.saraivateam.logdetreino.domain.LogExecucao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LogExecucaoRepository extends JpaRepository<LogExecucao, Long> {

    @Query("SELECT l FROM LogExecucao l WHERE LOWER(l.nomeExercicio) = LOWER(:nomeExercicio) AND l.tipoSerie = 'WORKING_SET' ORDER BY l.dataHoraExecucao DESC")
    List<LogExecucao> findHistoricoWorkingSet(@Param("nomeExercicio") String nomeExercicio);

    default Optional<LogExecucao> findUltimaCargaWorkingSet(String nomeExercicio) {
        List<LogExecucao> list = findHistoricoWorkingSet(nomeExercicio);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    List<LogExecucao> findByPlanoIdOrderByDataHoraExecucaoAsc(Long planoId);
}
