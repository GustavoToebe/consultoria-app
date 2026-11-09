package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ComunidadeMuralComentarioRepository extends JpaRepository<ComunidadeMuralComentario, UUID> {
    List<ComunidadeMuralComentario> findByPostIdAndOcultoFalseOrderByCriadoEmAsc(UUID postId);
    long countByPostIdAndOcultoFalse(UUID postId);
}
