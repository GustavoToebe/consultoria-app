package br.com.treinos.api.conta;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

/**
 * Contratos do checkout transparente (Asaas) da Minha conta. Dados de cartão e titular sobrescrevem
 * {@code toString()} para {@code "[PROTEGIDO]"} (PCI-DSS: PAN/CVV nunca vazam em logs ou exceções).
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

    public record PagarCartaoAsaasRequest(
            String cpfCnpj,
            Integer parcelas,
            @NotNull @Valid CartaoDados cartao,
            @NotNull @Valid TitularCartaoDados titular) {

        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record CartaoDados(
            @NotBlank String nomeImpresso,
            @NotBlank String numero,
            @NotBlank String mesValidade,
            @NotBlank String anoValidade,
            @NotBlank String cvv) {

        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record TitularCartaoDados(
            @NotBlank String nome,
            @NotBlank String cpfCnpj,
            String email,
            String telefone,
            @NotBlank String cep,
            String numeroEndereco) {

        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record CartaoAsaasResposta(
            UUID cobrancaId,
            String idExterno,
            String situacao,
            Instant pagoEm) { }

    public record SituacaoCobrancaResposta(
            UUID cobrancaId,
            String situacao,
            Instant pagoEm) { }
}
