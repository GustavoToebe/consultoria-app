package br.com.treinos.api.equipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
public interface UsuarioConviteRepository extends JpaRepository<UsuarioConvite,UUID> {
    List<UsuarioConvite> findByUsadoEmIsNullOrderByCriadoEmDesc();
    void deleteByEmailAndUsadoEmIsNull(String email);
    long countByPerfilIdAndUsadoEmIsNullAndExpiraEmAfter(UUID perfilId,java.time.Instant agora);
    void deleteByPerfilId(UUID perfilId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from UsuarioConvite c where c.codigoHash=:hash")
    Optional<UsuarioConvite> travarPorHash(String hash);
}
