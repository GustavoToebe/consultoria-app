package br.com.treinos.api.avaliacoes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); toda busca por aluno leva o aluno explícito. */
public interface AvaliacaoFisicaRepository extends JpaRepository<AvaliacaoFisica, UUID> {

    List<AvaliacaoFisica> findByAlunoIdOrderByDataDesc(UUID alunoId);

    boolean existsByAlunoIdAndData(UUID alunoId, LocalDate data);

    boolean existsByAlunoIdAndDataAndIdNot(UUID alunoId, LocalDate data, UUID id);
}
