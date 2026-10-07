package br.com.treinos.api.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Query("select t.usuarioId from RefreshToken t where t.tokenHash = :hash")
    Optional<UUID> usuarioDoToken(String hash);

    @Query("select count(t) from RefreshToken t where t.usuarioId = :usuarioId and t.usadoEm is null "
            + "and t.revogadoEm is null and t.expiraEm > :agora")
    long contarAtivos(UUID usuarioId, Instant agora);

    @Modifying
    @Query("update RefreshToken t set t.revogadoEm = :quando where t.usuarioId = :usuarioId and t.revogadoEm is null")
    int revogarTodos(UUID usuarioId, Instant quando);

    /**
     * Troca de senha e desativação: apaga em vez de revogar (lição da Central). Um token revogado apresentado de novo
     * conta como reuso e derrubaria também a sessão nova.
     */
    @Modifying
    @Query("delete from RefreshToken t where t.usuarioId = :usuarioId")
    int apagarTodos(UUID usuarioId);
}
