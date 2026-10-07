package br.com.treinos.api.execucao;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface RegistroPesoRepository extends JpaRepository<RegistroPeso, UUID> {

    List<RegistroPeso> findByAlunoIdOrderByDataAsc(UUID alunoId);

    Optional<RegistroPeso> findByAlunoIdAndData(UUID alunoId, LocalDate data);

    Optional<RegistroPeso> findByIdAndAlunoId(UUID id, UUID alunoId);
}
