package br.com.treinos.api.pagamentos;

import java.util.List;

/**
 * Como a cobrança foi paga. As quatro primeiras são do registro manual; as outras só vêm de um provedor. {@code KIWIFY} é a
 * baixa automática da Kiwify (a venda tem forma própria: o meio, cartão ou Pix, é decisão dela e fica no aviso).
 */
public enum FormaDePagamento {
    DINHEIRO, PIX_DIRETO, TRANSFERENCIA, OUTRO, PIX, BOLETO, CARTAO, KIWIFY;

    public static final List<FormaDePagamento> MANUAIS = List.of(DINHEIRO, PIX_DIRETO, TRANSFERENCIA, OUTRO);

    public boolean manual() {
        return MANUAIS.contains(this);
    }
}
