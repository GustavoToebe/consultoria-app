package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ComunidadeAulaComentarioRepository extends JpaRepository<ComunidadeAulaComentario, UUID> {
    Page<ComunidadeAulaComentario> findByAulaIdAndOcultoFalseOrderByCriadoEmAscIdAsc(UUID aulaId, Pageable pagina);
    List<ComunidadeAulaComentario> findByAulaIdOrderByCriadoEmAsc(UUID aulaId);
    long countByAulaIdAndOcultoFalse(UUID aulaId);

    /** Comentários visíveis por aulão da lista (só aulões com pelo menos um), numa consulta só. */
    interface TotalDaAula {
        UUID getAulaId();
        long getTotal();
    }

    @Query("select c.aulaId as aulaId, count(c) as total from ComunidadeAulaComentario c "
            + "where c.aulaId in :aulaIds and c.oculto = false group by c.aulaId")
    List<TotalDaAula> totaisVisiveis(Collection<UUID> aulaIds);
    List<ComunidadeAulaComentario> findTop5000ByAutorIdOrderByCriadoEmDesc(UUID autorId);
}
