package br.com.treinos.api.conta;

import java.util.Optional;
import java.util.UUID;

/**
 * De onde vêm os dados comerciais da Minha conta. Hoje: {@link FonteDaContaLocal} (tabelas locais de demonstração).
 * Na integração entra a {@code FonteDaContaCentral}, que chama {@code GET /integracao/v1/produtos/{produto}/instancias/
 * {idExterno}/minha-conta} assinado com HMAC (contrato, seção 6.3) e devolve o mesmo {@link MinhaContaDto}; nada na
 * rota nem na tela muda. Ver docs/integracao-central.md.
 */
public interface FonteDaConta {

    /** Vazio quando a consultoria não tem dados comerciais (a rota responde 404 CONTA_NAO_ENCONTRADA). */
    Optional<MinhaContaDto> minhaConta(UUID consultoriaId);

    /** {@code true} enquanto os dados são de demonstração e não da Central. */
    default boolean previa() {
        return false;
    }
}
