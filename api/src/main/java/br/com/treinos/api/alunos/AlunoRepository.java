package br.com.treinos.api.alunos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
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
     * Alunos ativos e não anonimizados com acesso, da consultoria da sessão (o {@code @TenantId}) e sem o do próprio {@code usuarioId}:
     * a base da lista de colegas. Uma consulta só; o filtro de reserva e idade é feito pela regra pura, em memória.
     */
    @Query("select new br.com.treinos.api.alunos.ColegaDaComunidade(a.id, a.usuarioId, a.nome, a.apelido, a.perfilReservado, a.dataNascimento, a.exibicaoDoNome) "
            + "from Aluno a where a.ativo = true and a.anonimizadoEm is null and a.usuarioId is not null and a.usuarioId <> :usuarioId")
    List<ColegaDaComunidade> colegasDaComunidade(UUID usuarioId);

    /**
     * Quem votou ou escreveu (por id de usuário) que é aluno, em qualquer situação, numa consulta só (mural e comentários também
     * a usam). Quem não vem é da equipe. Voto de anonimizado não existe (a anonimização os apaga); post e comentário dele ficam.
     */
    @Query("select new br.com.treinos.api.alunos.VotanteDaComunidade(a.id, a.usuarioId, a.nome, a.apelido, a.ativo, a.anonimizadoEm, "
            + "a.perfilReservado, a.dataNascimento, a.exibicaoDoNome) from Aluno a where a.usuarioId in :usuarioIds")
    List<VotanteDaComunidade> votantesDaComunidade(java.util.Collection<UUID> usuarioIds);

    /** Alunos da consultoria da sessão com este e-mail, sem diferenciar maiúsculas (importação assistida). */
    List<Aluno> findByEmailIgnoreCase(String email);

    /** CPF já formatado; a consulta fica só na consultoria da sessão. */
    boolean existsByCpf(String cpf);

    boolean existsByCpfAndIdNot(String cpf, UUID id);

    boolean existsByIdAndAcessoPausadoEmIsNotNull(UUID id);

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

    /**
     * Dia e mês de nascimento dos alunos ativos e não anonimizados com data informada, só do responsável quando vier
     * ({@code @TenantId} limita à consultoria da sessão). O ano nunca sai da consulta (D1 do plano de aniversários).
     */
    @Query("select new br.com.treinos.api.alunos.NascimentoSemAno(a.id, a.nome, extract(month from a.dataNascimento), "
            + "extract(day from a.dataNascimento)) from Aluno a where a.ativo = true and a.anonimizadoEm is null "
            + "and a.dataNascimento is not null and (:responsavelId is null or a.responsavelId = :responsavelId)")
    List<NascimentoSemAno> nascimentosSemAnoDoEscopo(UUID responsavelId);

    // ---- Pods da comunidade (V082) ----

    /** O pod do aluno lido do banco agora; vazio = sem pod (ou aluno de outra consultoria). É o que decide quem vê o mural do grupo. */
    @Query("select a.podId from Aluno a where a.id = :alunoId and a.podId is not null")
    Optional<UUID> podDoAluno(UUID alunoId);

    /** Quantos alunos estão no pod agora (inativar e anonimizar zeram o pod, então só ativos contam). Chamar com a linha do pod travada. */
    @Query("select count(a) from Aluno a where a.podId = :podId")
    long contarDoPod(UUID podId);

    /**
     * Coloca o aluno no pod só se ele ainda é aluno ativo, não anonimizado e com acesso (a ficha pode ter mudado desde que foi lida).
     * Devolve quantas linhas mudou (0 = não pode mais). Sempre com a consultoria explícita.
     * Limpa o contexto depois: quem chama relê o aluno para saber por que não pôde entrar.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Aluno a set a.podId = :podId where a.id = :alunoId and a.consultoriaId = :consultoriaId and a.ativo = true "
            + "and a.anonimizadoEm is null and a.usuarioId is not null")
    int colocarNoPod(UUID consultoriaId, UUID alunoId, UUID podId);

    /** Grava (ou zera com nulo) o momento da pausa de acesso sem regravar a ficha: so a coluna, sem subir a versao. */
    @Modifying(flushAutomatically = true)
    @Query("update Aluno a set a.acessoPausadoEm = :quando where a.id = :alunoId and a.consultoriaId = :consultoriaId")
    int definirAcessoPausadoEm(UUID consultoriaId, UUID alunoId, Instant quando);

    /** Tira o aluno do pod (nulo é válido): inativar, anonimizar, "Excluir minha conta" e a remoção pela equipe. */
    @Modifying(flushAutomatically = true)
    @Query("update Aluno a set a.podId = null where a.id = :alunoId and a.consultoriaId = :consultoriaId")
    int tirarDoPod(UUID consultoriaId, UUID alunoId);

    /** Membros por pod e quantos têm data de nascimento depois de {@code corte} (menores de 18); só as contagens saem daqui. */
    interface ContagemDoPod {
        UUID getPodId();
        long getMembros();
        Long getMenores();
    }

    @Query("select a.podId as podId, count(a) as membros, sum(case when a.dataNascimento > :corte then 1 else 0 end) as menores "
            + "from Aluno a where a.podId is not null group by a.podId")
    List<ContagemDoPod> contagensDosPods(java.time.LocalDate corte);
}
