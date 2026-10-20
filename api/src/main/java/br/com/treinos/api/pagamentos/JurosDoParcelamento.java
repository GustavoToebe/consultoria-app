package br.com.treinos.api.pagamentos;

/**
 * Quem paga os juros do parcelamento no cartão. {@code ALUNO} é o padrão: o provedor repassa os juros e o aluno paga mais
 * que o valor da cobrança. {@code TREINADOR} assume os juros (até 12 parcelas sem juros para o aluno) e só vale com API Key,
 * porque a opção que pede isso ao provedor só existe nos links gerados com chave.
 */
public enum JurosDoParcelamento {
    ALUNO(0),
    TREINADOR(12);

    private final int parcelasSemJuros;

    JurosDoParcelamento(int parcelasSemJuros) {
        this.parcelasSemJuros = parcelasSemJuros;
    }

    /** Parcelas que o aluno paga sem juros: o {@code assured_installments} do link. */
    public int parcelasSemJuros() {
        return parcelasSemJuros;
    }
}
