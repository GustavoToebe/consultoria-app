package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface ComunidadeMuralPostRepository extends JpaRepository<ComunidadeMuralPost, UUID> {
    Page<ComunidadeMuralPost> findByOcultoFalseOrderByFixadoDescCriadoEmDesc(Pageable pageable);
    Page<ComunidadeMuralPost> findAllByOrderByFixadoDescCriadoEmDesc(Pageable pageable);
}
