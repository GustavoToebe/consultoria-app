package br.com.treinos.api.pagamentos;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Contratos HTTP do Overtraining Pay (Asaas). Campos com dados pessoais ou sensíveis nunca aparecem em {@code toString()}.
 */
public final class OvertrainingPayDtos {

    private OvertrainingPayDtos() {
    }

    public record Etapas(boolean dadosCadastrados, boolean documentosAprovados, boolean testeHomologado, boolean ativa) {
    }

    public record CobrancaTesteResposta(String cobrancaTesteId, String situacao, long valorCentavos,
                                        String qrCodeBase64, String pixCopiaECola, Instant expiraEm) {
        @Override
        public String toString() {
            return "CobrancaTesteResposta[cobrancaTesteId=" + cobrancaTesteId + ", situacao=" + situacao + "]";
        }
    }

    public record OvertrainingPayResposta(String situacao, Etapas etapas, String tipoPessoa, String documentoMascarado,
                                          String nomeTitular, String emailFinanceiro, String telefoneMascarado,
                                          String cep, String enderecoResumo, Long rendaMensalCentavos,
                                          String bancoCodigo, String bancoNome, String agenciaMascarada,
                                          String contaMascarada, String tipoConta, boolean repasseAutomatico,
                                          String onboardingUrl,
                                          long cobrancasLiquidadas, Instant homologadaEm,
                                          CobrancaTesteResposta cobrancaTesteAtiva, Long versao) {
        @Override
        public String toString() {
            return "OvertrainingPayResposta[situacao=" + situacao + ", versao=" + versao + "]";
        }
    }

    public record SalvarOvertrainingPayRequest(String tipoPessoa, String documento, String nomeTitular,
                                               String emailFinanceiro, String telefone, String cep,
                                               String endereco, String numeroEndereco, String bairro,
                                               String enderecoResumo,
                                               Long rendaMensalCentavos, String tipoEmpresa, LocalDate dataNascimento,
                                               String bancoCodigo, String bancoNome, String agencia, String conta,
                                               String tipoConta, Boolean repasseAutomatico,
                                               Boolean rotacionarWebhook, Long versao) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }
}
