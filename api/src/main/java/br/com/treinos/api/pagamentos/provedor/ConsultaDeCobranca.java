package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;

import java.time.LocalDate;

/**
 * O que o provedor respondeu sobre uma cobrança. Forma, data e valor pago só vêm quando houve pagamento. {@code forma} é
 * nula quando o provedor devolve um meio que não conhecemos (nunca se chuta). {@code valorCentavos} é o valor da cobrança no
 * provedor (o do link, sem juros de parcelamento) e é o que se confere com o do servidor; {@code valorPagoCentavos} pode
 * incluir juros e serve só de informação. Valor ausente vem {@code null}. {@code parcelas} e {@code formaCapturada} (o meio
 * como o provedor o nomeou, já limpo e curto, mesmo quando {@code forma} é nula) também só informam; nada aqui é taxa nem
 * líquido.
 */
public record ConsultaDeCobranca(SituacaoNormalizada situacao, FormaDePagamento forma, LocalDate pagoEm,
                                 Long valorPagoCentavos, Long valorCentavos, Integer parcelas, String formaCapturada) {
}
