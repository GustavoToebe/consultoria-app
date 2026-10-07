package br.com.treinos.api.consultoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** {@link Consultoria} é global (sem {@code @TenantId}): quem chama sempre busca pelo id da sessão. */
public interface ConsultoriaRepository extends JpaRepository<Consultoria, UUID> {

    boolean existsBySlug(String slug);
}
