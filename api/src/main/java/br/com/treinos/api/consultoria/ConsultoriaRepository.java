package br.com.treinos.api.consultoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** {@link Consultoria} é global (sem {@code @TenantId}): quem chama sempre busca pelo id da sessão. */
public interface ConsultoriaRepository extends JpaRepository<Consultoria, UUID> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Consultoria c where c.id=:id")
    java.util.Optional<Consultoria> travar(UUID id);

    boolean existsBySlug(String slug);
}
