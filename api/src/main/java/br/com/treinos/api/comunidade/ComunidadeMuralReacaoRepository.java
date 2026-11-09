package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ComunidadeMuralReacaoRepository extends JpaRepository<ComunidadeMuralReacao, UUID> {
    List<ComunidadeMuralReacao> findByPostId(UUID postId);
    Optional<ComunidadeMuralReacao> findByPostIdAndUsuarioIdAndEmoji(UUID postId, UUID usuarioId, String emoji);
    void deleteByPostIdAndUsuarioIdAndEmoji(UUID postId, UUID usuarioId, String emoji);
}
