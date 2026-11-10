package br.com.treinos.api.alunos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Toda consulta já sai filtrada pela consultoria da sessão ({@code @TenantId} em {@link Aluno}), também as da lista com
 * filtros ({@link FiltrosDaListaDeAlunos#especificacao}, Criteria).
 */
public interface AlunoRepository extends JpaRepository<Aluno, UUID>, JpaSpecificationExecutor<Aluno> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Aluno a where a.id = :id")
    Optional<Aluno> buscarParaAlterar(UUID id);

    /** Trava vários alunos da consultoria atual de uma vez (ações em lote), em ordem de id para não travar em círculo. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Aluno a where a.id in :ids order by a.id")
    List<Aluno> buscarParaAlterarVarios(java.util.Collection<UUID> ids);

    /** Trava o aluno do convite: dois aceites simultâneos ficam em série e só o primeiro consome o código. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Aluno a where a.conviteHash = :hash")
    Optional<Aluno> buscarPorConviteParaAlterar(String hash);

    @Query("select a from Aluno a where a.conviteHash = :hash")
    Optional<Aluno> buscarPorConvite(String hash);

    /** O aluno do usuário (único por consultoria da sessão); de outra consultoria ou sem aluno, vazio. */
    Optional<Aluno> findByUsuarioId(UUID usuarioId);

    /** Como {@link #findByUsuarioId}, travando a linha (moderação do apelido). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Aluno a where a.usuarioId = :usuarioId")
    Optional<Aluno> buscarPorUsuarioParaAlterar(UUID usuarioId);

    /**
     * Autores da comunidade (por id de usuário) que são aluno ativo e não anonimizado, com o apelido atual (nulo se não tem), numa
     * consulta só: quem não vem é da equipe ou não abre perfil (o mural usa isso para saber se o autor é clicável).
     */
    @Query("select new br.com.treinos.api.alunos.ApelidoDoAutor(a.usuarioId, a.apelido) from Aluno a "
            + "where a.usuarioId in :usuarioIds and a.ativo = true and a.anonimizadoEm is null")
    List<ApelidoDoAutor> autoresAlunosDosUsuarios(java.util.Collection<UUID> usuarioIds);

    /**
     * Alunos ativos e não anonimizados com acesso, da consultoria da sessão (o {@code @TenantId}) e sem o do próprio {@code usuarioId}:
     * a base da lista de colegas. Uma consulta só; o filtro de reserva e idade é feito pela regra pura, em memória.
     */
    @Query("select new br.com.treinos.api.alunos.ColegaDaComunidade(a.id, a.usuarioId, a.nome, a.apelido, a.perfilReservado, a.dataNascimento) "
            + "from Aluno a where a.ativo = true and a.anonimizadoEm is null and a.usuarioId is not null and a.usuarioId <> :usuarioId")
    List<ColegaDaComunidade> colegasDaComunidade(UUID usuarioId);

    /** Alunos da consultoria da sessão com este e-mail, sem diferenciar maiúsculas (importação assistida). */
    List<Aluno> findByEmailIgnoreCase(String email);

    /** CPF já formatado; a consulta fica só na consultoria da sessão. */
    boolean existsByCpf(String cpf);

    boolean existsByCpfAndIdNot(String cpf, UUID id);

    long countByAtivoTrue();

    /**
     * Alunos ativos com mais treinos concluídos (aceitos, não reabertos) do que {@code treinos}: a posição de um aluno no
     * ranking de constância da comunidade é este número + 1. Uma consulta só, sem nome nem id de ninguém.
     */
    @Query("select count(a) from Aluno a where a.ativo = true and (select count(s) from SessaoConcluida s "
            + "where s.alunoId = a.id and s.situacao = 'ACEITO' and s.concluida = true) > :treinos")
    long contarAtivosComMaisTreinosConcluidos(long treinos);

    List<Aluno> findByAtivoTrueOrderByNomeAsc();

    /** Alunos ativos; com {@code responsavelId} só os dele ("Meus alunos"). Painel e listas usam esta mesma consulta. */
    @Query("select a from Aluno a where a.ativo = true and (:responsavelId is null or a.responsavelId = :responsavelId) "
            + "order by a.nome asc")
    List<Aluno> ativosDoEscopo(UUID responsavelId);

    /**
     * Alunos inativos e não anonimizados; com {@code responsavelId} só os dele. Mesmo filtro de responsável do
     * {@link #ativosDoEscopo}; só a contagem do painel (a rosca de alunos por situação).
     */
    @Query("select count(a) from Aluno a where a.ativo = false and a.anonimizadoEm is null "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    long contarInativosNaoAnonimizadosDoEscopo(UUID responsavelId);

    /**
     * Alunos ativos e não anonimizados do responsável: a contagem do limite de alunos do treinador (D6) e a mesma dos Números.
     * {@code exceto} tira da conta um aluno que já pode estar gravado com o responsável (o que a operação está mexendo); nulo = ninguém.
     */
    @Query("select count(a) from Aluno a where a.responsavelId = :responsavelId and a.ativo = true and a.anonimizadoEm is null "
            + "and (:exceto is null or a.id <> :exceto)")
    long contarAtivosDoResponsavel(UUID responsavelId, UUID exceto);
}
