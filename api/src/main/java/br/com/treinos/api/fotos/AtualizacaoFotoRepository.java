package br.com.treinos.api.fotos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todas. */
interface AtualizacaoFotoRepository extends JpaRepository<AtualizacaoFoto, UUID> {

    /** Conta também as removidas: quem sobe e apaga em volta continua batendo no limite do dia. */
    long countByAlunoIdAndCriadaEmAfter(UUID alunoId, Instant desde);

    List<AtualizacaoFoto> findByAlunoIdAndRemovidaEmIsNull(UUID alunoId);

    List<AtualizacaoFoto> findByAtualizacaoIdInAndRemovidaEmIsNullOrderByCriadaEmAsc(java.util.Collection<UUID> atualizacaoIds);

    List<AtualizacaoFoto> findByAlunoIdOrderByCriadaEmAsc(UUID alunoId);

    /**
     * Liga a foto pendente à resposta. Um UPDATE só, com a condição dentro: a foto precisa ser do aluno, da pasta, estar
     * pendente e não removida; zero linhas = recusa. Atômico contra a limpeza das pendentes (que também é um UPDATE).
     */
    @Modifying
    @Query("update AtualizacaoFoto f set f.atualizacaoId = :atualizacaoId, f.perguntaId = :perguntaId, f.ligadaEm = :quando "
            + "where f.id = :id and f.alunoId = :alunoId and f.pastaId = :pastaId "
            + "and f.atualizacaoId is null and f.removidaEm is null")
    int ligar(UUID id, UUID alunoId, UUID pastaId, UUID atualizacaoId, String perguntaId, Instant quando);

    /** Marca como removida só se ainda pendente (foto ligada a uma atualização enviada não se apaga pelo aluno). */
    @Modifying
    @Query("update AtualizacaoFoto f set f.removidaEm = :quando where f.id = :id and f.alunoId = :alunoId "
            + "and f.atualizacaoId is null and f.removidaEm is null")
    int removerPendente(UUID id, UUID alunoId, Instant quando);
}
