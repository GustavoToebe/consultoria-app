package br.com.treinos.api.vitrine;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Itens da vitrine da consultoria da sessão ({@code @TenantId}: outra consultoria não aparece, nem por id). */
public interface VitrineItemRepository extends JpaRepository<VitrineItem, UUID> {

    @Query("select i from VitrineItem i order by i.ordem, i.nome, i.id")
    List<VitrineItem> todos();

    @Query("select i from VitrineItem i where i.ativo = true order by i.ordem, i.nome, i.id")
    List<VitrineItem> ativos();

    /** Todos, já travados na ordem da lista: quem reordena nunca cruza o trinco de outra reordenação (sem deadlock). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from VitrineItem i order by i.ordem, i.nome, i.id")
    List<VitrineItem> todosParaAlterar();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from VitrineItem i where i.id = :id")
    Optional<VitrineItem> buscarParaAlterar(UUID id);

    @Query("select coalesce(max(i.ordem), -1) from VitrineItem i")
    int maiorOrdem();
}
