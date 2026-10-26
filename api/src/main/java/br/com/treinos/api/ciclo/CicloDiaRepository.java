package br.com.treinos.api.ciclo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CicloDiaRepository extends JpaRepository<CicloDia, UUID> {

    List<CicloDia> findByAlunoIdAndDataGreaterThanEqualOrderByDataDesc(UUID alunoId, LocalDate desde);

    Optional<CicloDia> findByAlunoIdAndData(UUID alunoId, LocalDate data);

    @Modifying
    @Query("delete from CicloDia d where d.alunoId = ?1")
    void apagarDoAluno(UUID alunoId);
}
