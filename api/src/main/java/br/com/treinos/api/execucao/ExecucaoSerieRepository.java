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

    record UltimaVez(UUID exercicioId, LocalDate data) {
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

    /** Coluna "Anterior" (Engajamento 0.3): a última data, antes de {@code ate}, com série feita de cada exercício. */
    @Query("select new br.com.treinos.api.execucao.ExecucaoSerieRepository$UltimaVez(e.exercicioId, max(e.data)) "
            + "from ExecucaoSerie e where e.alunoId = :alunoId and e.exercicioId in :exercicioIds and e.concluida = true "
            + "and e.data < :ate group by e.exercicioId")
    List<UltimaVez> ultimaVezDosExercicios(UUID alunoId, Collection<UUID> exercicioIds, LocalDate ate);

    /** As séries feitas desses exercícios nessas datas (quem chama casa exercício e data). */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndConcluidaTrueAndDataIn(
            UUID alunoId, Collection<UUID> exercicioIds, Collection<LocalDate> datas);

    List<ExecucaoSerie> findTop300ByOrderByRecebidoEmDesc();
}
