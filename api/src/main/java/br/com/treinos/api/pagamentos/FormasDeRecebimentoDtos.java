package br.com.treinos.api.pagamentos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Contratos HTTP das formas de recebimento da consultoria. A chave Pix é dado pessoal: entra só no PUT, nunca volta (a resposta
 * traz {@code chaveMascarada} e {@code chaveConfigurada}) e os {@code toString} dos records a escondem.
 */
public final class FormasDeRecebimentoDtos {

    private FormasDeRecebimentoDtos() { }

    /**
     * {@code tipoChave} é texto para o tipo desconhecido virar 422 {@code FORMAS_INVALIDAS} no campo (e não 400 do JSON).
     * {@code chave} em branco mantém a já gravada, desde que o tipo seja o mesmo.
     */
    public record PixConfigRequest(String tipoChave, String chave, String nomeRecebedor, String cidade) {
        @Override
        public String toString() {
            return "PixConfigRequest[]";
        }
    }

    /** {@code versao} nula só na primeira gravação (a consultoria ainda não tem linha). {@code manual} é sempre {@code true}. */
    public record FormasDeRecebimentoRequest(@NotNull Boolean infinitePay, @NotNull Boolean linkProprio, @NotNull Boolean pix,
                                             @NotNull Boolean manual, @Valid PixConfigRequest pixConfig, Long versao,
                                             Boolean overtrainingPay) {
        public FormasDeRecebimentoRequest(Boolean infinitePay, Boolean linkProprio, Boolean pix, Boolean manual,
                                          PixConfigRequest pixConfig, Long versao) {
            this(infinitePay, linkProprio, pix, manual, pixConfig, versao, null);
        }
    }

    /** {@code chaveConfigurada} é sempre verdadeiro quando o objeto existe; a chave inteira nunca volta. */
    public record PixConfigResponse(String tipoChave, boolean chaveConfigurada, String chaveMascarada, String nomeRecebedor,
                                    String cidade) { }

    /** O Pix copia e cola de uma cobrança do aluno. O código leva a chave do treinador (dado pessoal): nunca em log nem {@code toString}. */
    public record CodigoPix(String codigo) {
        @Override
        public String toString() {
            return "CodigoPix[]";
        }
    }

    /** {@code pixConfig} nulo = nunca configurado; {@code versao} nula = nunca gravou (vale o padrão: InfinitePay e Manual ligados). */
    public record FormasDeRecebimentoResponse(boolean infinitePay, boolean overtrainingPay, boolean linkProprio, boolean pix,
                                              boolean manual, PixConfigResponse pixConfig, Long versao) { }
}
