package br.com.treinos.api.termos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}); sempre com o usuário explícito. */
public interface AceiteTermoRepository extends JpaRepository<AceiteTermo, UUID> {

    boolean existsByUsuarioIdAndVersao(UUID usuarioId, String versao);

    /**
     * Escalar de propósito: logo depois do {@code saveAndFlush} do aceite, a entidade gerenciada tem {@code aceitoEm} nulo
     * (a coluna é preenchida pelo banco e não é relida); a consulta escalar lê o valor gravado.
     */
    @Query("select a.aceitoEm from AceiteTermo a where a.usuarioId = :usuarioId and a.versao = :versao")
    Optional<Instant> aceitoEm(UUID usuarioId, String versao);
}
