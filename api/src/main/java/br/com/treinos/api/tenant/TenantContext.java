package br.com.treinos.api.tenant;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Consultoria da requisição atual, lida pelo Hibernate em toda entidade com {@code @TenantId}. Preenchida pelo
 * {@code JwtAuthenticationFilter} a partir do usuário no banco (nunca do token nem do corpo) e limpa no
 * {@code finally}: uma thread reaproveitada não pode herdar a consultoria da requisição anterior.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> ATUAL = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(UUID consultoriaId) {
        if (consultoriaId == null) {
            throw new IllegalArgumentException("consultoriaId não pode ser nulo");
        }
        ATUAL.set(consultoriaId);
    }

    /** @return a consultoria da requisição atual, ou {@code null} se nenhuma foi definida. */
    public static UUID get() {
        return ATUAL.get();
    }

    public static void clear() {
        ATUAL.remove();
    }

    /**
     * Executa com a consultoria informada e restaura a anterior no fim. Para rotas públicas que já resolveram a
     * consultoria pelo próprio recurso (ex.: aceitar convite) e para o seed. A transação precisa começar
     * <b>dentro</b> do bloco: o Hibernate lê o tenant ao abrir a sessão.
     */
    public static <T> T executarComo(UUID consultoriaId, Supplier<T> acao) {
        UUID anterior = ATUAL.get();
        set(consultoriaId);
        try {
            return acao.get();
        } finally {
            if (anterior == null) {
                ATUAL.remove();
            } else {
                ATUAL.set(anterior);
            }
        }
    }
}
