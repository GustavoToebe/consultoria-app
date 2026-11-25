package br.com.treinos.api.pagamentos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Contratos HTTP do Checkout Transparente do aluno no Overtraining Pay (Asaas).
 * Todos os records com CPF, PAN, CVV ou dados do titular sobrescrevem {@code toString()} para {@code "[PROTEGIDO]"}.
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

    public record CartaoAlunoDados(
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

    public record TitularCartaoAlunoDados(
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

    public record PagarCartaoAlunoRequest(
            String cpfPagador,
            @NotNull @Min(1) @Max(12) Integer parcelas,
            @NotNull @Valid CartaoAlunoDados cartao,
            @NotNull @Valid TitularCartaoAlunoDados titular) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    public record CartaoAlunoResponse(UUID cobrancaId, String asaasCobrancaId, String situacao, LocalDate pagoEm) {
        @Override
        public String toString() {
            return "CartaoAlunoResponse[cobrancaId=" + cobrancaId + ", situacao=" + situacao + "]";
        }
    }

    public record SituacaoCobrancaAlunoResponse(UUID cobrancaId, String situacao, LocalDate pagoEm) {
    }
}
