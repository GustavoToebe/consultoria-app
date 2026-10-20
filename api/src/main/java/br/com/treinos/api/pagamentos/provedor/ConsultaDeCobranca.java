package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;

import java.time.LocalDate;

/** O que o provedor respondeu sobre uma cobrança. Forma, data e valor pago só vêm quando houve pagamento. */
public record ConsultaDeCobranca(SituacaoNormalizada situacao, FormaDePagamento forma, LocalDate pagoEm,
                                 Long valorPagoCentavos) {
}
