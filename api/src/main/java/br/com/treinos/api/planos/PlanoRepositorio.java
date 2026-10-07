package br.com.treinos.api.planos;

import org.springframework.data.jpa.repository.JpaRepository;
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

    Optional<P> findByAlunoIdAndAtivoTrue(UUID alunoId);

    List<P> findByAlunoIdInAndAtivoTrue(Collection<UUID> alunoIds);

    List<P> findByAtivoTrueAndFimBetweenOrderByFimAsc(LocalDate de, LocalDate ate);

    /** Publicar um plano tira o anterior do mesmo aluno de vigência (mesma transação, antes de ligar o novo). */
    @Modifying(flushAutomatically = true)
    @Query("update #{#entityName} p set p.ativo = false where p.alunoId = :alunoId and p.ativo = true and p.id <> :exceto")
    int desativarOutros(UUID alunoId, UUID exceto);
}
