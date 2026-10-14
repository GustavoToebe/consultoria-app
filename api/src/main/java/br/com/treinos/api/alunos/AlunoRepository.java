package br.com.treinos.api.alunos;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Toda consulta já sai filtrada pela consultoria da sessão ({@code @TenantId} em {@link Aluno}). */
public interface AlunoRepository extends JpaRepository<Aluno, UUID> {

    @Query("select a from Aluno a where lower(a.nome) like :padrao escape '\\' and "
            + "(:situacao = 'TODOS' or (:situacao = 'ATIVO' and a.ativo = true) "
            + "or (:situacao = 'INATIVO' and a.ativo = false)) "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) order by lower(a.nome)")
    Page<Aluno> buscar(String padrao, String situacao, UUID responsavelId, Pageable pagina);

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

    long countByAtivoTrue();

    List<Aluno> findByAtivoTrueOrderByNomeAsc();

    /** Alunos ativos; com {@code responsavelId} só os dele ("Meus alunos"). Painel e listas usam esta mesma consulta. */
    @Query("select a from Aluno a where a.ativo = true and (:responsavelId is null or a.responsavelId = :responsavelId) "
            + "order by a.nome asc")
    List<Aluno> ativosDoEscopo(UUID responsavelId);
}
