package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ComunidadeMuralComentarioRepository extends JpaRepository<ComunidadeMuralComentario, UUID> {
    Page<ComunidadeMuralComentario> findByPostIdAndOcultoFalseOrderByCriadoEmAscIdAsc(UUID postId, Pageable pagina);
    long countByPostIdAndOcultoFalse(UUID postId);
    List<ComunidadeMuralComentario> findTop5000ByAutorIdOrderByCriadoEmDesc(UUID autorId);
}
