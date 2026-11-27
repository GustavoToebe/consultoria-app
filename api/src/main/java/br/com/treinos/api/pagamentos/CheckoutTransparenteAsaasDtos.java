package br.com.treinos.api.pagamentos;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Contratos HTTP do Checkout Transparente do aluno no Overtraining Pay (Asaas).
 * O request com CPF sobrescreve {@code toString()} para {@code "[PROTEGIDO]"}. Cartão é só pela fatura do Asaas:
 * nenhum contrato aqui recebe número, validade ou CVV.
 */
public final class CheckoutTransparenteAsaasDtos {

    private CheckoutTransparenteAsaasDtos() {
    }

    public record GerarPixAlunoRequest(String cpfPagador) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record PixAlunoResponse(UUID cobrancaId, String asaasCobrancaId, long valorCentavos,
                                   String qrCodeBase64, String codigoCopiaECola, Instant expiraEm) {
        @Override
        public String toString() {
            return "PixAlunoResponse[cobrancaId=" + cobrancaId + ", asaasCobrancaId=" + asaasCobrancaId + "]";
        }
    }

    public record SituacaoCobrancaAlunoResponse(UUID cobrancaId, String situacao, LocalDate pagoEm) {
    }
}
