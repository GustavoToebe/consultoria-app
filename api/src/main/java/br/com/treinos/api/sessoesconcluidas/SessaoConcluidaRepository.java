package br.com.treinos.api.sessoesconcluidas;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Leituras das sessões concluídas. Já filtradas pela consultoria ({@code @TenantId}); sempre com o aluno explícito. */
public interface SessaoConcluidaRepository extends JpaRepository<SessaoConcluida, UUID> {

    List<SessaoConcluida> findByAlunoIdAndSituacaoAndDataBetweenOrderByDataDescIdAsc(UUID alunoId, String situacao,
                                                                                     LocalDate de, LocalDate ate);

    /** Quantos registros do aluno estão concluídos, em todo o histórico (a consultoria sai do {@code @TenantId}). */
    long countByAlunoIdAndSituacaoAndConcluidaTrue(UUID alunoId, String situacao);

    /** Os dias (sem repetir, do mais antigo ao mais novo) em que o aluno concluiu algum treino em [{@code de}, {@code ate}]: só datas. */
    @Query("select distinct s.data from SessaoConcluida s where s.alunoId = :alunoId and s.situacao = 'ACEITO' "
            + "and s.concluida = true and s.data between :de and :ate order by s.data asc")
    List<LocalDate> diasConcluidos(UUID alunoId, LocalDate de, LocalDate ate);

    /** Uma sessão concluída do aluno para o XP: o dia, o resultado e (para a semana completa) a versão e a sessão do plano. */
    record SessaoParaXp(LocalDate data, String resultado, UUID planoVersaoId, UUID sessaoUid) {
    }

    /** Todas as sessões concluídas (aceitas, não reabertas) do aluno: a base do XP, que não tem janela (janela faria o XP cair). */
    @Query("select new br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository$SessaoParaXp(s.data, s.resultado, "
            + "s.planoVersaoId, s.sessaoUid) from SessaoConcluida s where s.alunoId = :alunoId and s.situacao = 'ACEITO' "
            + "and s.concluida = true")
    List<SessaoParaXp> sessoesParaXp(UUID alunoId);

    /**
     * Quantas sessões concluídas (aceitas, não reabertas, completas ou parciais) os alunos têm em [{@code de}, {@code ate}]:
     * uma linha por (aluno, versão, sessão, data). Só o número do "Início" do treinador; a consultoria sai do {@code @TenantId}.
     */
    @Query("select count(s) from SessaoConcluida s where s.alunoId in :alunoIds and s.situacao = 'ACEITO' "
            + "and s.concluida = true and s.data between :de and :ate")
    long contarConcluidasDosAlunos(Collection<UUID> alunoIds, LocalDate de, LocalDate ate);

    /** A sessão concluída com trava: marcar o "Visto" duas vezes ao mesmo tempo fica em série (e não duplica). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SessaoConcluida s where s.id = :id")
    Optional<SessaoConcluida> travar(UUID id);
}
