package br.com.treinos.api.conta;

import br.com.treinos.api.conta.PagamentoTransparenteDto.CartaoAsaasResposta;
import br.com.treinos.api.conta.PagamentoTransparenteDto.GerarPixAsaasRequest;
import br.com.treinos.api.conta.PagamentoTransparenteDto.PagarCartaoAsaasRequest;
import br.com.treinos.api.conta.PagamentoTransparenteDto.PixAsaasResposta;
import br.com.treinos.api.conta.PagamentoTransparenteDto.SituacaoCobrancaResposta;

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

    /** Gera cobrança Pix transparente (Asaas) na Central para uma cobrança aberta desta consultoria. */
    default PixAsaasResposta gerarPixAsaas(UUID consultoriaId, UUID cobrancaId, GerarPixAsaasRequest request) {
        throw new PagamentoIndisponivelException();
    }

    /** Processa pagamento com cartão transparente (Asaas) na Central para uma cobrança aberta desta consultoria. */
    default CartaoAsaasResposta pagarCartaoAsaas(UUID consultoriaId, UUID cobrancaId,
                                                 PagarCartaoAsaasRequest request, String remoteIp) {
        throw new PagamentoIndisponivelException();
    }

    /** Consulta a situação atual de uma cobrança na Central (polling de confirmação). */
    default SituacaoCobrancaResposta consultarSituacaoCobranca(UUID consultoriaId, UUID cobrancaId) {
        throw new PagamentoIndisponivelException();
    }

    /** {@code true} enquanto os dados são de demonstração e não da Central. */
    default boolean previa() {
        return false;
    }
}
