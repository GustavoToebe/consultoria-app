package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos (capa de outra consultoria não aparece). */
public interface ComunidadeCapaRepository extends JpaRepository<ComunidadeCapa, UUID> {

    /** Id da capa e do dono, sem os bytes. */
    interface DonoDaCapa {
        UUID getId();
        UUID getAulaId();
        UUID getPostId();
    }

    boolean existsByIdAndAulaId(UUID id, UUID aulaId);

    @Query("select c.id as id, c.aulaId as aulaId, c.postId as postId from ComunidadeCapa c where c.aulaId in :aulaIds")
    List<DonoDaCapa> idsDasAulas(Collection<UUID> aulaIds);

    @Query("select c.id as id, c.aulaId as aulaId, c.postId as postId from ComunidadeCapa c where c.postId in :postIds")
    List<DonoDaCapa> idsDosPosts(Collection<UUID> postIds);

    /** Pendentes criadas antes de {@code limite}: nunca foram ligadas a um dono. */
    @Modifying(flushAutomatically = true)
    @Query("delete from ComunidadeCapa c where c.aulaId is null and c.postId is null and c.criadoEm < :limite")
    int apagarPendentesAntigas(Instant limite);

    /** Liga a capa pendente ao dono; devolve quantas ligou (0 = não existe, é de outra consultoria ou já tem dono). */
    @Modifying(flushAutomatically = true)
    @Query("update ComunidadeCapa c set c.aulaId = :aulaId where c.id = :id and c.aulaId is null and c.postId is null")
    int ligarAAula(UUID id, UUID aulaId);

    @Modifying(flushAutomatically = true)
    @Query("update ComunidadeCapa c set c.postId = :postId where c.id = :id and c.aulaId is null and c.postId is null")
    int ligarAoPost(UUID id, UUID postId);

    @Modifying(flushAutomatically = true)
    @Query("delete from ComunidadeCapa c where c.aulaId = :aulaId")
    int apagarDaAula(UUID aulaId);

    @Modifying(flushAutomatically = true)
    @Query("delete from ComunidadeCapa c where c.postId = :postId")
    int apagarDoPost(UUID postId);
}
