package br.com.treinos.api.auth;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    java.util.List<Usuario> findByConsultoriaIdAndPapelOrderByNomeAsc(UUID consultoriaId, Papel papel);
    long countByConsultoriaIdAndPerfilId(UUID consultoriaId,UUID perfilId);

    /** O e-mail já chega normalizado ({@code Emails.normalizar}); o índice único é em {@code lower(email)}. */
    @Query("select u from Usuario u where lower(u.email) = :email")
    Optional<Usuario> buscarPorEmail(String email);

    @Query("select count(u) > 0 from Usuario u where lower(u.email) = :email")
    boolean existeEmail(String email);

    /**
     * Trava a linha do usuário: refresh, troca de senha e desativação ficam em série (como a Central). Sem a trava,
     * dois refresh simultâneos do mesmo token poderiam gerar duas sessões.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.id = :id")
    Optional<Usuario> buscarParaAlterar(UUID id);
}
