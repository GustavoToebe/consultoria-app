package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos. */
public interface ComunidadeMuralReacaoRepository extends JpaRepository<ComunidadeMuralReacao, UUID> {

    /** Quantas reações de cada código há em cada post. */
    interface Contagem {
        UUID getPostId();
        String getCodigo();
        long getTotal();
    }

    /** Código que o usuário deu em um post. */
    interface DoUsuario {
        UUID getPostId();
        String getCodigo();
    }

    boolean existsByPostIdAndUsuarioIdAndCodigo(UUID postId, UUID usuarioId, String codigo);

    @Query("select r.postId as postId, r.codigo as codigo, count(r) as total from ComunidadeMuralReacao r "
            + "where r.postId in :postIds group by r.postId, r.codigo")
    List<Contagem> contagens(Collection<UUID> postIds);

    @Query("select r.postId as postId, r.codigo as codigo from ComunidadeMuralReacao r "
            + "where r.postId in :postIds and r.usuarioId = :usuarioId")
    List<DoUsuario> doUsuario(Collection<UUID> postIds, UUID usuarioId);

    /** Idempotente: sem a reação, não apaga nada. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("delete from ComunidadeMuralReacao r where r.postId = :postId and r.usuarioId = :usuarioId and r.codigo = :codigo")
    int desfazer(UUID postId, UUID usuarioId, String codigo);

    List<ComunidadeMuralReacao> findTop5000ByUsuarioIdOrderByCriadoEmDesc(UUID usuarioId);
}
