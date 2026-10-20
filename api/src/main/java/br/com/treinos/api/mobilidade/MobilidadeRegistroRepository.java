package br.com.treinos.api.mobilidade;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Leituras dos registros de mobilidade. Já filtradas pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface MobilidadeRegistroRepository extends JpaRepository<MobilidadeRegistro, UUID> {

    List<MobilidadeRegistro> findByAlunoIdAndSituacaoAndDataBetweenOrderByDataDescIdAsc(UUID alunoId, String situacao,
                                                                                         LocalDate de, LocalDate ate);
}
