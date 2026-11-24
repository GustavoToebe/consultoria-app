package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.ContratoDaContratacao;
import br.com.treinos.api.pagamentos.PagamentosDtos.MaisAntigaVencida;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * A conta do contrato fechado (V098), sem banco nem relógio ({@code hoje} é de Brasília, dado por quem chama): o bloco
 * {@code contrato} da resposta, o saldo e o limite do próximo pagamento. O app nunca faz essa conta.
 *
 * <p>Só entram as cobranças do contrato (AVULSA e RENEGOCIACAO ligadas à contratação; quem chama já filtrou: a multa de saída, que
 * também tem contratação, fica de fora). Pago = PAGA. O saldo é {@code max(0, total − pago)}. O limite do próximo lançamento é
 * {@code total − PAGA − ABERTA − CONTESTADA} (a aberta reserva saldo e a cancelada o devolve; ESTORNADA e RENEGOCIADA não contam),
 * também nunca negativo.
 */
final class ContaDoContrato {

    /** Uma cobrança do contrato, só com o que a conta precisa. */
    record Linha(UUID id, String descricao, CobrancaAluno.Situacao situacao, LocalDate vencimento, long valorCentavos) {

        static Linha de(CobrancaAluno c) {
            return new Linha(c.getId(), c.getDescricao(), c.getSituacao(), c.getVencimento(), c.getValorCentavos());
        }
    }

    private ContaDoContrato() {
    }

    static ContratoDaContratacao bloco(ModoDeCobranca modo, long total, List<Linha> cobrancas, LocalDate hoje) {
        long pago = 0;
        long reservado = 0;
        int pagas = 0;
        int validas = 0;
        int vencidas = 0;
        long valorVencido = 0;
        Linha maisAntiga = null;
        for (Linha c : cobrancas) {
            switch (c.situacao()) {
                case PAGA -> {
                    pago = Math.addExact(pago, c.valorCentavos());
                    pagas++;
                }
                case ABERTA, CONTESTADA -> reservado = Math.addExact(reservado, c.valorCentavos());
                default -> { }
            }
            if (c.situacao() != CobrancaAluno.Situacao.CANCELADA && c.situacao() != CobrancaAluno.Situacao.ESTORNADA) {
                validas++;
            }
            if (c.situacao() == CobrancaAluno.Situacao.ABERTA && c.vencimento().isBefore(hoje)) {
                vencidas++;
                valorVencido = Math.addExact(valorVencido, c.valorCentavos());
                if (maisAntiga == null || ORDEM.compare(c, maisAntiga) < 0) {
                    maisAntiga = c;
                }
            }
        }
        MaisAntigaVencida antiga = maisAntiga == null ? null : new MaisAntigaVencida(maisAntiga.id(), maisAntiga.descricao(),
                maisAntiga.vencimento(), ChronoUnit.DAYS.between(maisAntiga.vencimento(), hoje));
        return new ContratoDaContratacao(modo, total, pago, Math.max(0, total - pago),
                Math.max(0, total - pago - reservado), pagas, validas, vencidas, valorVencido, antiga);
    }

    /** O desempate é o id, para a resposta não depender da ordem do banco. */
    private static final Comparator<Linha> ORDEM = Comparator.comparing(Linha::vencimento)
            .thenComparing(Linha::id, Comparator.nullsFirst(Comparator.naturalOrder()));
}
