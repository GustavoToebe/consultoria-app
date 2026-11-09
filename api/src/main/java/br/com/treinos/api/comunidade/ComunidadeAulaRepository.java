package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ComunidadeAulaRepository extends JpaRepository<ComunidadeAula, UUID> {
    List<ComunidadeAula> findByPublicadaTrueOrderByOrdemAscCriadaEmDesc();
    List<ComunidadeAula> findAllByOrderByOrdemAscCriadaEmDesc();
}
