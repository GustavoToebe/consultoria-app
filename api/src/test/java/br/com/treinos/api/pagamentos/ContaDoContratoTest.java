package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.CobrancaAluno.Situacao;
import br.com.treinos.api.pagamentos.ContaDoContrato.Linha;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratoDaContratacao;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A conta pura do contrato fechado (V098): pago, saldo, limite do próximo lançamento e o atraso. Sem banco nem relógio. */
class ContaDoContratoTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 24);

    private static Linha linha(Situacao situacao, long valor, LocalDate vencimento) {
        return new Linha(UUID.randomUUID(), "Cobrança fictícia", situacao, vencimento, valor);
    }

    private static ContratoDaContratacao bloco(long total, Linha... linhas) {
        return ContaDoContrato.bloco(ModoDeCobranca.SALDO_ABERTO, total, List.of(linhas), HOJE);
    }

    @Test
    void semCobrancaOSaldoETudoEOLimiteTambem() {
        ContratoDaContratacao b = bloco(10_000);

        assertThat(b.pagoCentavos()).isZero();
        assertThat(b.saldoCentavos()).isEqualTo(10_000);
        assertThat(b.limiteDeLancamentoCentavos()).isEqualTo(10_000);
        assertThat(b.cobrancasTotal()).isZero();
        assertThat(b.maisAntigaVencida()).isNull();
        assertThat(b.modo()).isEqualTo(ModoDeCobranca.SALDO_ABERTO);
    }

    @Test
    void soAPagaAbateOSaldoEOLimiteReservaAbertaEContestada() {
        ContratoDaContratacao b = bloco(10_000,
                linha(Situacao.PAGA, 2_000, HOJE.minusDays(5)),
                linha(Situacao.ABERTA, 1_500, HOJE.plusDays(3)),
                linha(Situacao.CONTESTADA, 500, HOJE.minusDays(1)),
                linha(Situacao.CANCELADA, 3_000, HOJE),
                linha(Situacao.ESTORNADA, 700, HOJE));

        assertThat(b.pagoCentavos()).isEqualTo(2_000);
        assertThat(b.saldoCentavos()).isEqualTo(8_000);
        assertThat(b.limiteDeLancamentoCentavos()).isEqualTo(6_000);
        assertThat(b.cobrancasPagas()).isEqualTo(1);
        assertThat(b.cobrancasTotal()).as("cancelada e estornada não contam").isEqualTo(3);
    }

    @Test
    void saldoELimiteNuncaFicamNegativos() {
        ContratoDaContratacao b = bloco(1_000,
                linha(Situacao.PAGA, 1_500, HOJE), linha(Situacao.ABERTA, 400, HOJE.plusDays(1)));

        assertThat(b.saldoCentavos()).isZero();
        assertThat(b.limiteDeLancamentoCentavos()).isZero();
    }

    @Test
    void soAAbertaComVencimentoAntesDeHojeEVencidaEAMaisAntigaVenceuPrimeiro() {
        Linha antiga = linha(Situacao.ABERTA, 800, HOJE.minusDays(31));
        ContratoDaContratacao b = bloco(10_000,
                linha(Situacao.ABERTA, 100, HOJE),
                linha(Situacao.ABERTA, 200, HOJE.plusDays(1)),
                linha(Situacao.ABERTA, 300, HOJE.minusDays(2)),
                antiga,
                linha(Situacao.PAGA, 400, HOJE.minusDays(40)));

        assertThat(b.vencidas()).isEqualTo(2);
        assertThat(b.valorVencidoCentavos()).isEqualTo(1_100);
        assertThat(b.maisAntigaVencida().cobrancaId()).isEqualTo(antiga.id());
        assertThat(b.maisAntigaVencida().diasDeAtraso()).isEqualTo(31);
        assertThat(b.maisAntigaVencida().vencimento()).isEqualTo(HOJE.minusDays(31));
        assertThat(b.maisAntigaVencida().descricao()).isEqualTo("Cobrança fictícia");
    }

    @Test
    void venceHojeNaoEVencida() {
        assertThat(bloco(1_000, linha(Situacao.ABERTA, 1_000, HOJE)).vencidas()).isZero();
    }
}
