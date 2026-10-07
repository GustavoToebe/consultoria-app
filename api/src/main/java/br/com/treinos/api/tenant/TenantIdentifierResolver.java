package br.com.treinos.api.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Ponte entre o {@link TenantContext} e o Hibernate: entidades com {@code @TenantId} recebem
 * {@code where consultoria_id = ?} na leitura e o valor certo na escrita.
 *
 * <p>Nunca lança exceção (lição do Servirea, 21/09/2026): o Spring Data abre sessões na inicialização, antes de
 * existir requisição. Sem contexto devolve {@link #SEM_CONSULTORIA}, o UUID zero, que não existe na tabela
 * {@code consultoria}: leitura volta vazia e escrita falha pela FK (falha segura).</p>
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<UUID> {

    public static final UUID SEM_CONSULTORIA = new UUID(0L, 0L);

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        UUID consultoriaId = TenantContext.get();
        return consultoriaId != null ? consultoriaId : SEM_CONSULTORIA;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}
