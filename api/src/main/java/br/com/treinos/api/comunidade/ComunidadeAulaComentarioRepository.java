package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ComunidadeAulaComentarioRepository extends JpaRepository<ComunidadeAulaComentario, UUID> {
    List<ComunidadeAulaComentario> findByAulaIdAndOcultoFalseOrderByCriadoEmAsc(UUID aulaId);
    List<ComunidadeAulaComentario> findByAulaIdOrderByCriadoEmAsc(UUID aulaId);
    long countByAulaIdAndOcultoFalse(UUID aulaId);
}
