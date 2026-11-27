package br.com.treinos.api.planos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Consultas comuns aos planos de treino e de dieta. Já filtradas pela consultoria ({@code @TenantId}). */
@NoRepositoryBean
public interface PlanoRepositorio<P extends PlanoBase> extends JpaRepository<P, UUID> {

    List<P> findByAlunoIdOrderByCriadoEmDesc(UUID alunoId);

    List<P> findByPastaId(UUID pastaId);

    Optional<P> findByAlunoIdAndAtivoTrue(UUID alunoId);

    List<P> findByAlunoIdInAndAtivoTrue(Collection<UUID> alunoIds);

    List<P> findByAtivoTrueAndFimBetweenOrderByFimAsc(LocalDate de, LocalDate ate);

    /** Os planos agendados (não arquivados, com {@code liberarEm}) dos alunos dados: o painel confere se o vigente já tem sucessor. */
    @Query("select p from #{#entityName} p where p.alunoId in :alunoIds and p.liberarEm is not null and p.arquivado = false")
    List<P> agendadosDosAlunos(Collection<UUID> alunoIds);

    /** Ids dos planos cuja data de liberação chegou (a consultoria vem do {@code @TenantId}); arquivado nunca entra. */
    @Query("select p.id from #{#entityName} p where p.liberarEm <= :hoje and p.arquivado = false order by p.liberarEm, p.publicadoEm, p.id")
    List<UUID> idsParaLiberar(LocalDate hoje);

    /** O plano com trava de linha: quem libera relê o estado já sob a trava (idempotente, duas instâncias não liberam duas vezes). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from #{#entityName} p where p.id = :id")
    Optional<P> travarParaLiberar(UUID id);

    /**
     * Publicar um plano tira o anterior do mesmo aluno de vigência (mesma transação, antes de ligar o novo). Zera também a
     * {@code liberarEm} dele: um agendamento pendente do desativado não pode religá-lo depois por cima do novo vigente.
     */
    @Modifying(flushAutomatically = true)
    @Query("update #{#entityName} p set p.ativo = false, p.liberarEm = null where p.alunoId = :alunoId and p.ativo = true and p.id <> :exceto")
    int desativarOutros(UUID alunoId, UUID exceto);
}
