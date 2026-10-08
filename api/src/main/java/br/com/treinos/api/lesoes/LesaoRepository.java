package br.com.treinos.api.lesoes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface LesaoRepository extends JpaRepository<LesaoAluno, UUID> {

    List<LesaoAluno> findByAlunoIdOrderByDataInicioDescCriadoEmDesc(UUID alunoId);

    Optional<LesaoAluno> findByIdAndAlunoId(UUID id, UUID alunoId);
}
