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

    /** Progresso: séries que contam como trabalho (papel na metodologia da versão), com carga comum registrada. */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdAndContaNoProgressoTrueAndCargaNotNullOrderByDataAsc(
            UUID alunoId, UUID exercicioId);

    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndSerieTrabalhoTrueAndCargaNotNullOrderByDataDesc(
            UUID alunoId, Collection<UUID> exercicioIds);

    /**
     * Recordes pessoais (Engajamento 0.2): séries feitas com carga e repetições e sem etapas, antes de {@code ate}, dos
     * exercícios do plano. Quem chama ainda confere, pela versão, que a série é simples (sem técnica).
     */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBefore(
            UUID alunoId, Collection<UUID> exercicioIds, LocalDate ate);

    List<ExecucaoSerie> findTop300ByOrderByRecebidoEmDesc();
}
