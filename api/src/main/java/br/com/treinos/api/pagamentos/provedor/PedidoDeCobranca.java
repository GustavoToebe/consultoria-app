package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * O que o núcleo pede ao provedor para cobrar. {@code referencia} é o id da cobrança dele, devolvido nos avisos. O valor é
 * sempre o do servidor. {@code urlDoAviso} leva o token do webhook (a única credencial dele): por isso {@code toString}
 * não imprime nada além da referência. {@code urlDeRetorno}, {@code urlDoAviso} e {@code validade} são opcionais.
 * {@code parcelasSemJuros} (0 a 12) é quantas parcelas o aluno paga sem juros, ou seja, quantas o vendedor assume.
 * {@code validade} e {@code parcelasSemJuros} só valem para quem tem a credencial completa (com chave): o adaptador decide
 * pela credencial o que vai ao provedor.
 */
public record PedidoDeCobranca(UUID referencia, long valorCentavos, LocalDate vencimento, String descricao,
                               Set<FormaDePagamento> formas, int parcelas, String urlDeRetorno, String urlDoAviso,
                               Instant validade, int parcelasSemJuros) {

    @Override
    public String toString() {
        return "PedidoDeCobranca[referencia=" + referencia + "]";
    }
}
