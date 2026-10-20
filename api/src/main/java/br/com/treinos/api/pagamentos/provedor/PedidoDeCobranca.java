package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/** O que o núcleo pede ao provedor para cobrar. {@code referencia} é o id da cobrança dele, devolvido nos avisos. */
public record PedidoDeCobranca(UUID referencia, long valorCentavos, LocalDate vencimento, String descricao,
                               Set<FormaDePagamento> formas, int parcelas) {
}
