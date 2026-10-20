package br.com.treinos.api.pagamentos.provedor;

/**
 * O que um provedor faz. Quem tem {@code geraCobranca} falso não recebe {@code gerarCobranca}; quem tem
 * {@code recebeWebhook} falso não recebe {@code lerWebhook}. {@code maxParcelas} é 1 quando não há parcelamento.
 */
public record CapacidadesDoProvedor(boolean pix, boolean boleto, boolean cartao, int maxParcelas,
                                    boolean simulacaoDeTaxa, boolean estorno, boolean contestacao,
                                    boolean geraCobranca, boolean recebeWebhook) {

    public CapacidadesDoProvedor {
        if (maxParcelas < 1) {
            throw new IllegalArgumentException("maxParcelas precisa ser ao menos 1.");
        }
    }
}
