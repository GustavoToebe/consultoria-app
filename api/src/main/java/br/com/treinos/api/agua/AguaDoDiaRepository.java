package br.com.treinos.api.agua;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Leituras da água do dia. Já filtradas pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface AguaDoDiaRepository extends JpaRepository<AguaDoDia, UUID> {

    List<AguaDoDia> findByAlunoIdAndDataBetweenOrderByDataDesc(UUID alunoId, LocalDate de, LocalDate ate);
}
