package br.com.treinos.api.conta;

import java.time.Instant;
import java.util.UUID;

/**
 * Contratos do Pix transparente (Asaas) da Minha conta. Cartão é só pela página do Asaas (link externo): nenhum
 * contrato aqui recebe número, validade ou CVV.
 */
public final class PagamentoTransparenteDto {

    private PagamentoTransparenteDto() { }

    public record GerarPixAsaasRequest(String cpfCnpj) { }

    public record PixAsaasResposta(
            UUID cobrancaId,
            String idExterno,
            Long valorCentavos,
            String qrCodeBase64,
            String codigoCopiaECola,
            Instant expiraEm) { }

    public record SituacaoCobrancaResposta(
            UUID cobrancaId,
            String situacao,
            Instant pagoEm) { }
}
