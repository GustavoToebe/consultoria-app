package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos (foto de outra consultoria não aparece). */
public interface ComunidadeMuralFotoRepository extends JpaRepository<ComunidadeMuralFoto, UUID> {

    /** Id da foto e do post, sem os bytes. */
    interface IdDaFoto {
        UUID getPostId();
        UUID getId();
    }

    /** Metadados da foto para a exportação (nunca a imagem). */
    interface Metadados {
        UUID getId();
        UUID getPostId();
        int getTamanho();
        Instant getCriadoEm();
    }

    @Query("select f.postId as postId, f.id as id from ComunidadeMuralFoto f where f.postId in :postIds order by f.criadoEm, f.id")
    List<IdDaFoto> idsDosPosts(Collection<UUID> postIds);

    /** Pendentes sem post criadas antes de {@code limite}: nunca foram publicadas. */
    @Modifying
    @Query("delete from ComunidadeMuralFoto f where f.postId is null and f.criadoEm < :limite")
    int apagarPendentesAntigas(Instant limite);

    /**
     * Liga as pendentes do autor ao post num UPDATE só: devolve quantas ligou, e quem chama compara com o pedido (id de outro
     * autor, inexistente ou já ligado fica de fora).
     */
    @Modifying(flushAutomatically = true)
    @Query("update ComunidadeMuralFoto f set f.postId = :postId where f.id in :ids and f.autorId = :autorId and f.postId is null")
    int vincular(UUID postId, UUID autorId, Collection<UUID> ids);

    @Modifying
    @Query("delete from ComunidadeMuralFoto f where f.postId = :postId")
    int apagarDoPost(UUID postId);

    List<Metadados> findTop5000ByAutorIdOrderByCriadoEmDesc(UUID autorId);
}
