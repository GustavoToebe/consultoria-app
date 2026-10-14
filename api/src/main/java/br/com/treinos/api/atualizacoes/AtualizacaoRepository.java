package br.com.treinos.api.atualizacoes;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
public interface AtualizacaoRepository extends JpaRepository<Atualizacao, UUID> {
    Optional<Atualizacao> findByPastaId(UUID pastaId);
    List<Atualizacao> findByAlunoIdOrderByDataAtualizacaoDesc(UUID alunoId);
    List<Atualizacao> findAllByOrderByDataAtualizacaoDesc();
    /**
     * Alunos ativos do escopo ("Meus alunos" quando há responsável) que têm pasta vigente, com a atualização da pasta se já
     * existir. Pasta vigente = a do treino ativo ou, sem ela, a da dieta ativa (mesma regra de {@code pastaAtiva}).
     * JPQL: o {@code @TenantId} vale em todas as entidades. A fase é calculada em Java por {@link RegrasAtualizacao}.
     */
    @Query("select new br.com.treinos.api.atualizacoes.LinhaAtualizacao(a.id, a.nome, p.id, p.fim, u.id, "
            + "u.dataAtualizacao, u.atrasoAte, u.estado) from Aluno a "
            + "left join PlanoTreino t on t.alunoId = a.id and t.ativo = true "
            + "left join PlanoDieta d on d.alunoId = a.id and d.ativo = true "
            + "join PastaPlano p on p.id = coalesce(t.pastaId, d.pastaId) and p.alunoId = a.id "
            + "and p.arquivado = false and p.fim is not null "
            + "left join Atualizacao u on u.pastaId = p.id "
            + "where a.ativo = true and (:responsavelId is null or a.responsavelId = :responsavelId) order by a.nome asc")
    List<LinhaAtualizacao> linhasDoPainel(UUID responsavelId);

    /** Mesma consulta de {@link #linhasDoPainel}, só para os alunos de uma página da lista (sem filtro de responsável). */
    @Query("select new br.com.treinos.api.atualizacoes.LinhaAtualizacao(a.id, a.nome, p.id, p.fim, u.id, "
            + "u.dataAtualizacao, u.atrasoAte, u.estado) from Aluno a "
            + "left join PlanoTreino t on t.alunoId = a.id and t.ativo = true "
            + "left join PlanoDieta d on d.alunoId = a.id and d.ativo = true "
            + "join PastaPlano p on p.id = coalesce(t.pastaId, d.pastaId) and p.alunoId = a.id "
            + "and p.arquivado = false and p.fim is not null "
            + "left join Atualizacao u on u.pastaId = p.id "
            + "where a.ativo = true and a.id in :alunoIds order by a.nome asc")
    List<LinhaAtualizacao> linhasDosAlunos(Collection<UUID> alunoIds);

    /**
     * A data da atualização acompanha o fim da pasta enquanto ela estiver ABERTA; enviada ou revisada não muda.
     * Update condicional (não carrega a entidade), para não disputar a versão com o envio do aluno.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Atualizacao a set a.dataAtualizacao = :fim where a.pastaId = :pastaId and a.estado = 'ABERTA'")
    int moverDataDaAberta(UUID pastaId, LocalDate fim);

    /** Sem "versioned": ler o feedback não pode dar 409 a quem está editando o texto. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Atualizacao a set a.feedbackVistoEm = :quando where a.id = :id and a.alunoId = :alunoId "
            + "and a.feedbackEm is not null and a.feedbackVistoEm is null")
    int marcarFeedbackVisto(UUID id, UUID alunoId, Instant quando);
}
