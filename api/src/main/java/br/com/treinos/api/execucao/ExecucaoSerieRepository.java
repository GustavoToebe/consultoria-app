package br.com.treinos.api.execucao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Leituras das séries registradas. Já filtradas pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface ExecucaoSerieRepository extends JpaRepository<ExecucaoSerie, UUID> {

    record UltimoRegistro(UUID alunoId, LocalDate data) {
    }

    List<ExecucaoSerie> findByAlunoIdAndDataBetweenOrderByDataDesc(UUID alunoId, LocalDate de, LocalDate ate);

    @Query("select new br.com.treinos.api.execucao.ExecucaoSerieRepository$UltimoRegistro(e.alunoId, max(e.data)) "
            + "from ExecucaoSerie e where e.alunoId in :alunoIds group by e.alunoId")
    List<UltimoRegistro> ultimoRegistro(Collection<UUID> alunoIds);

    List<ExecucaoSerie> findByAlunoIdAndExercicioIdAndSerieTrabalhoTrueAndCargaNotNullOrderByDataAsc(
            UUID alunoId, UUID exercicioId);

    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndSerieTrabalhoTrueAndCargaNotNullOrderByDataDesc(
            UUID alunoId, Collection<UUID> exercicioIds);

    List<ExecucaoSerie> findTop300ByOrderByRecebidoEmDesc();
}
