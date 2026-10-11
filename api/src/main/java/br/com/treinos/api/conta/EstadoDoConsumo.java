package br.com.treinos.api.conta;

/** Situação de um item do consumo diante do limite do plano (mesmos nomes do Servirea). */
public enum EstadoDoConsumo {
    SEM_LIMITE_CONFIGURADO, DISPONIVEL, ATENCAO, ATINGIDO, EXCEDIDO;

    /**
     * Regra do Servirea: sem limite = não configurado; acima do limite = excedido; igual = atingido; a partir de 80% do
     * limite (arredondado para cima) e abaixo dele = atenção; o resto é disponível.
     */
    public static EstadoDoConsumo de(long ocupacao, Long limite) {
        if (limite == null) {
            return SEM_LIMITE_CONFIGURADO;
        }
        if (ocupacao > limite) {
            return EXCEDIDO;
        }
        if (ocupacao == limite) {
            return ATINGIDO;
        }
        return limite > 0 && ocupacao >= (4 * limite + 4) / 5 ? ATENCAO : DISPONIVEL;
    }
}
