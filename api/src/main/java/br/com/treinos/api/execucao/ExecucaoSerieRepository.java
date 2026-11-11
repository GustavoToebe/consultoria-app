package br.com.treinos.api.execucao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
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

    /** Maior repetição feita com uma carga, numa série do plano de uma versão (recordes da semana: base de antes do período). */
    record MelhorRepeticao(UUID alunoId, UUID exercicioId, UUID planoVersaoId, UUID serieUid, BigDecimal carga, Integer repeticoes) {
    }

    List<ExecucaoSerie> findByAlunoIdAndDataBetweenOrderByDataDesc(UUID alunoId, LocalDate de, LocalDate ate);

    @Query("select new br.com.treinos.api.execucao.ExecucaoSerieRepository$UltimoRegistro(e.alunoId, max(e.data)) "
            + "from ExecucaoSerie e where e.alunoId in :alunoIds group by e.alunoId")
    List<UltimoRegistro> ultimoRegistro(Collection<UUID> alunoIds);

    /** Progresso: séries que contam como trabalho (papel na metodologia da versão), com carga comum registrada. */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdAndContaNoProgressoTrueAndCargaNotNullOrderByDataAsc(
            UUID alunoId, UUID exercicioId);

    /** Última carga de trabalho: a data mais recente de cada exercício (índice {@code ix_exec_aluno_exercicio}). */
    @Query("select new br.com.treinos.api.execucao.ExecucaoSerieRepository$UltimaVez(e.exercicioId, max(e.data)) "
            + "from ExecucaoSerie e where e.alunoId = :alunoId and e.exercicioId in :exercicioIds "
            + "and e.serieTrabalho = true and e.carga is not null group by e.exercicioId")
    List<UltimaVez> ultimaDataDeTrabalho(UUID alunoId, Collection<UUID> exercicioIds);

    /** As séries de trabalho com carga desses exercícios nessas datas (quem chama casa exercício e data). */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndSerieTrabalhoTrueAndCargaNotNullAndDataIn(
            UUID alunoId, Collection<UUID> exercicioIds, Collection<LocalDate> datas);

    /**
     * Recordes pessoais (Engajamento 0.2): séries feitas com carga e repetições e sem etapas, antes de {@code ate}, dos
     * exercícios do plano. Quem chama ainda confere, pela versão, que a série é simples (sem técnica).
     */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBefore(
            UUID alunoId, Collection<UUID> exercicioIds, LocalDate ate);

    /** Exercícios em que o aluno já fez série com carga e repetições e sem etapas (perfil do colega: recordes de carga). */
    @Query("select distinct e.exercicioId from ExecucaoSerie e where e.alunoId = :alunoId and e.concluida = true "
            + "and e.carga is not null and e.repeticoes is not null and e.etapas is null and e.exercicioId is not null")
    List<UUID> exerciciosComSerieFeita(UUID alunoId);

    /** Recordes da semana (Engajamento 0.5): as séries simples candidatas do período, de vários alunos. */
    List<ExecucaoSerie> findByAlunoIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBetween(
            Collection<UUID> alunoIds, LocalDate de, LocalDate ate);

    /**
     * Recordes da semana: as de antes do período, dos mesmos alunos e exercícios, já agrupadas por aluno, exercício, versão,
     * série e carga com a maior repetição (basta para a maior carga, o maior volume e as repetições por carga).
     */
    @Query("select new br.com.treinos.api.execucao.ExecucaoSerieRepository$MelhorRepeticao(e.alunoId, e.exercicioId, "
            + "e.planoVersaoId, e.serieUid, e.carga, max(e.repeticoes)) from ExecucaoSerie e "
            + "where e.alunoId in :alunoIds and e.exercicioId in :exercicioIds and e.concluida = true and e.carga is not null "
            + "and e.repeticoes is not null and e.etapas is null and e.data < :ate "
            + "group by e.alunoId, e.exercicioId, e.planoVersaoId, e.serieUid, e.carga")
    List<MelhorRepeticao> melhoresAntesDe(Collection<UUID> alunoIds, Collection<UUID> exercicioIds, LocalDate ate);

    /** Coluna "Anterior" (Engajamento 0.3): a última data, antes de {@code ate}, com série feita de cada exercício. */
    @Query("select new br.com.treinos.api.execucao.ExecucaoSerieRepository$UltimaVez(e.exercicioId, max(e.data)) "
            + "from ExecucaoSerie e where e.alunoId = :alunoId and e.exercicioId in :exercicioIds and e.concluida = true "
            + "and e.data < :ate group by e.exercicioId")
    List<UltimaVez> ultimaVezDosExercicios(UUID alunoId, Collection<UUID> exercicioIds, LocalDate ate);

    /** As séries feitas desses exercícios nessas datas (quem chama casa exercício e data). */
    List<ExecucaoSerie> findByAlunoIdAndExercicioIdInAndConcluidaTrueAndDataIn(
            UUID alunoId, Collection<UUID> exercicioIds, Collection<LocalDate> datas);

    /** Atividade recente do Início: as 300 séries mais recentes dos alunos do escopo (o teto vale dentro do escopo, não da consultoria). */
    List<ExecucaoSerie> findTop300ByAlunoIdInOrderByRecebidoEmDesc(Collection<UUID> alunoIds);
}
