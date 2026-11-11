package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ComunidadeMuralDenunciaRepository extends JpaRepository<ComunidadeMuralDenuncia, UUID> {

    interface Contagem {
        UUID getPostId();
        long getTotal();
    }

    boolean existsByPostIdAndUsuarioId(UUID postId, UUID usuarioId);

    /** Denúncias de cada post da lista, numa consulta só (posts sem denúncia não aparecem). */
    @Query("select d.postId as postId, count(d) as total from ComunidadeMuralDenuncia d where d.postId in :postIds group by d.postId")
    List<Contagem> contagens(Collection<UUID> postIds);

    @Modifying
    @Query("delete from ComunidadeMuralDenuncia d where d.postId = :postId")
    int apagarDoPost(UUID postId);

    /** Exportação LGPD: as denúncias que o usuário fez. */
    List<ComunidadeMuralDenuncia> findTop5000ByUsuarioIdOrderByCriadoEmDesc(UUID usuarioId);
}
