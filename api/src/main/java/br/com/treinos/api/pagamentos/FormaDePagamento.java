package br.com.treinos.api.pagamentos;

import java.util.List;

/** Como a cobrança foi paga. As quatro primeiras são do registro manual; as outras só vêm de um provedor (Fase 2). */
public enum FormaDePagamento {
    DINHEIRO, PIX_DIRETO, TRANSFERENCIA, OUTRO, PIX, BOLETO, CARTAO;

    public static final List<FormaDePagamento> MANUAIS = List.of(DINHEIRO, PIX_DIRETO, TRANSFERENCIA, OUTRO);

    public boolean manual() {
        return MANUAIS.contains(this);
    }
}
