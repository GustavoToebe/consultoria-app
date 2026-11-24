package br.com.treinos.api.pagamentos;

/**
 * Como a contratação cobra (V098, docs/planos/contrato-fechado.md). {@code RECORRENTE} é o de sempre (uma mensalidade por período, sem
 * fim marcado). Nos dois modos fechados há um valor total: {@code PARCELADO_FIXO} tem entrada e parcelas com data e valor, e
 * {@code SALDO_ABERTO} tem entrada e pagamentos livres até quitar. Nenhum dos dois gera mensalidade.
 */
public enum ModoDeCobranca {
    RECORRENTE, PARCELADO_FIXO, SALDO_ABERTO;

    public boolean fechado() {
        return this != RECORRENTE;
    }
}
