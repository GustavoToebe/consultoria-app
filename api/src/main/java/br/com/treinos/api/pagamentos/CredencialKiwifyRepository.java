package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}); só há uma credencial por consultoria. */
public interface CredencialKiwifyRepository extends JpaRepository<CredencialKiwify, UUID> {

    @Query("select c from CredencialKiwify c")
    Optional<CredencialKiwify> daConsultoria();

    @Query("select count(c) > 0 from CredencialKiwify c")
    boolean configurada();
}
