package br.com.treinos.api.pagamentos.provedor;

import java.util.UUID;

/**
 * O que identifica uma cobrança na consulta ao provedor. {@code referencia} é o id da cobrança (o {@code order_nsu}),
 * {@code idExterno} é a transação no provedor ({@code transaction_nsu}) e {@code slug} é o do link (pode faltar).
 */
public record PedidoDeConsulta(UUID referencia, String idExterno, String slug) {
}
