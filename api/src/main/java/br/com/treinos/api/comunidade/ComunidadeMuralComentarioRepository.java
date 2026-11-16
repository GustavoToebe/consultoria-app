package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ComunidadeMuralComentarioRepository extends JpaRepository<ComunidadeMuralComentario, UUID> {
    Page<ComunidadeMuralComentario> findByPostIdAndOcultoFalseOrderByCriadoEmAscIdAsc(UUID postId, Pageable pagina);
    /** Post de dúvida: os comentários da equipe vêm primeiro, depois por data. */
    Page<ComunidadeMuralComentario> findByPostIdAndOcultoFalseOrderByDaEquipeDescCriadoEmAscIdAsc(UUID postId, Pageable pagina);

    /** Posts da lista que têm algum comentário visível da equipe, numa consulta só. */
    @Query("select distinct c.postId from ComunidadeMuralComentario c where c.postId in :postIds and c.oculto = false and c.daEquipe = true")
    List<UUID> comRespostaDaEquipe(Collection<UUID> postIds);

    /** Comentários visíveis por post da lista (só posts com pelo menos um), numa consulta só. */
    interface TotalDoPost {
        UUID getPostId();
        long getTotal();
    }

    @Query("select c.postId as postId, count(c) as total from ComunidadeMuralComentario c "
            + "where c.postId in :postIds and c.oculto = false group by c.postId")
    List<TotalDoPost> totaisVisiveis(Collection<UUID> postIds);

    List<ComunidadeMuralComentario> findTop5000ByAutorIdOrderByCriadoEmDesc(UUID autorId);
}
