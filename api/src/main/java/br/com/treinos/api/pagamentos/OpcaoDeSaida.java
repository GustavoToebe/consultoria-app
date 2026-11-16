package br.com.treinos.api.pagamentos;

/**
 * As opções ao encerrar uma contratação antes do tempo mínimo (docs/planos/saida-e-tempo-minimo.md). {@code FALTAM}: cancela as
 * mensalidades abertas a vencer dentro do mínimo e cobra a soma delas e dos meses não gerados; {@code VIGENTE}: um mês;
 * {@code OUTRO}: o valor digitado; {@code NAO_COBRAR}: encerra sem cobrança de saída.
 */
public enum OpcaoDeSaida {
    FALTAM, VIGENTE, OUTRO, NAO_COBRAR
}
