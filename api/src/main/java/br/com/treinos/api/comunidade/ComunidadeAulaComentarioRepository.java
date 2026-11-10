package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ComunidadeAulaComentarioRepository extends JpaRepository<ComunidadeAulaComentario, UUID> {
    Page<ComunidadeAulaComentario> findByAulaIdAndOcultoFalseOrderByCriadoEmAscIdAsc(UUID aulaId, Pageable pagina);
    List<ComunidadeAulaComentario> findByAulaIdOrderByCriadoEmAsc(UUID aulaId);
    long countByAulaIdAndOcultoFalse(UUID aulaId);
    List<ComunidadeAulaComentario> findTop5000ByAutorIdOrderByCriadoEmDesc(UUID autorId);
}
