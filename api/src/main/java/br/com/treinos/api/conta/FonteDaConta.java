package br.com.treinos.api.conta;

import java.util.Optional;
import java.util.UUID;

/**
 * De onde vêm os dados comerciais da Minha conta. Hoje: {@link FonteDaContaLocal} (tabelas locais de demonstração).
 * Na integração entra a {@code FonteDaContaCentral}, que chama {@code GET /integracao/v1/produtos/{produto}/instancias/
 * {idExterno}/minha-conta} assinado com HMAC (contrato) e devolve o mesmo {@link MinhaContaDto}; nada na
 * rota nem na tela muda. Ver docs/integracao-central.md.
 */
public interface FonteDaConta {

    /** Vazio quando a consultoria não tem dados comerciais (a rota responde 404 CONTA_NAO_ENCONTRADA). */
    Optional<MinhaContaDto> minhaConta(UUID consultoriaId);

    /**
     * Link do checkout de uma cobrança aberta desta consultoria (contrato 6.4 da Central). Sem Central não há pagamento:
     * a fonte local (prévia) responde {@link PagamentoIndisponivelException}.
     */
    default String linkDePagamento(UUID consultoriaId, UUID cobrancaId) {
        throw new PagamentoIndisponivelException();
    }

    /** {@code true} enquanto os dados são de demonstração e não da Central. */
    default boolean previa() {
        return false;
    }
}
