package br.com.treinos.api.termos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); sempre com o usuário explícito. */
public interface AceiteTermoRepository extends JpaRepository<AceiteTermo, UUID> {

    boolean existsByUsuarioIdAndVersao(UUID usuarioId, String versao);
}
