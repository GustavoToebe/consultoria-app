package br.com.treinos.api.ciclo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CicloRegistroRepository extends JpaRepository<CicloRegistro, UUID> {

    List<CicloRegistro> findByAlunoIdAndInicioGreaterThanEqualOrderByInicioDesc(UUID alunoId, LocalDate desde);

    List<CicloRegistro> findByAlunoIdOrderByInicioAsc(UUID alunoId);

    @Modifying
    @Query("delete from CicloRegistro r where r.alunoId = ?1")
    void apagarDoAluno(UUID alunoId);
}
