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

    /** Fotos já ligadas às anamneses dadas (exportação). */
    List<AtualizacaoFoto> findByAnamneseIdInAndPerguntaIdIsNotNullAndRemovidaEmIsNullOrderByCriadaEmAsc(java.util.Collection<UUID> anamneseIds);

    List<AtualizacaoFoto> findByAlunoIdOrderByCriadaEmAsc(UUID alunoId);

    /**
     * Fotos já ligadas do aluno, com a atualização ou a anamnese e o conteúdo da versão respondida.
     * Pendente (pergunta nula) e removida ficam de fora. Uma consulta só; o filtro de estado fecha no serviço.
     */
    @Query("select new br.com.treinos.api.fotos.LinhaDaFoto(f.id, f.perguntaId, f.criadaEm, a.id, a.dataAtualizacao, "
            + "a.estado, a.respostas, va.conteudo, n.id, n.situacao, n.enviadaEm, n.respostas, vn.conteudo) "
            + "from AtualizacaoFoto f "
            + "left join Atualizacao a on a.id = f.atualizacaoId "
            + "left join QuestionarioVersao va on va.id = a.questionarioVersaoId "
            + "left join Anamnese n on n.id = f.anamneseId "
            + "left join QuestionarioVersao vn on vn.id = n.questionarioVersaoId "
            + "where f.alunoId = :alunoId and f.removidaEm is null and f.perguntaId is not null")
    List<LinhaDaFoto> linhaDoTempo(UUID alunoId);

    /**
     * Liga a foto pendente à resposta. Um UPDATE só, com a condição dentro: a foto precisa ser do aluno, da pasta, estar
     * pendente e não removida; zero linhas = recusa. Atômico contra a limpeza das pendentes (que também é um UPDATE).
     */
    @Modifying
    @Query("update AtualizacaoFoto f set f.atualizacaoId = :atualizacaoId, f.perguntaId = :perguntaId, f.ligadaEm = :quando "
            + "where f.id = :id and f.alunoId = :alunoId and f.pastaId = :pastaId "
            + "and f.perguntaId is null and f.removidaEm is null")
    int ligar(UUID id, UUID alunoId, UUID pastaId, UUID atualizacaoId, String perguntaId, Instant quando);

    /** Mesma regra de {@link #ligar}, para a foto pendente de uma anamnese. */
    @Modifying
    @Query("update AtualizacaoFoto f set f.perguntaId = :perguntaId, f.ligadaEm = :quando "
            + "where f.id = :id and f.alunoId = :alunoId and f.anamneseId = :anamneseId "
            + "and f.perguntaId is null and f.removidaEm is null")
    int ligarNaAnamnese(UUID id, UUID alunoId, UUID anamneseId, String perguntaId, Instant quando);

    /** Marca como removida só se ainda pendente (foto ligada a um envio não se apaga pelo aluno). */
    @Modifying
    @Query("update AtualizacaoFoto f set f.removidaEm = :quando where f.id = :id and f.alunoId = :alunoId "
            + "and f.perguntaId is null and f.removidaEm is null")
    int removerPendente(UUID id, UUID alunoId, Instant quando);
}
