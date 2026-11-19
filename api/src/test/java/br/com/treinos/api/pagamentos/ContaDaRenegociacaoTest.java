package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.ParcelaDaPreviaDaRenegociacao;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** A conta da renegociação (D14) sem banco: parcelas iguais com a sobra na última, vencimentos presos ao fim do mês, texto fixo. */
class ContaDaRenegociacaoTest {

    @Test
    void parcelasIguaisComASobraDosCentavosNaUltimaESomaIgualAoTotal() {
        List<ParcelaDaPreviaDaRenegociacao> p = ContaDaRenegociacao.parcelas(10_001, 3, LocalDate.of(2027, 1, 10));

        assertThat(p).extracting(ParcelaDaPreviaDaRenegociacao::valorCentavos).containsExactly(3_333L, 3_333L, 3_335L);
        assertThat(p).extracting(ParcelaDaPreviaDaRenegociacao::numero).containsExactly(1, 2, 3);
        assertThat(p.stream().mapToLong(ParcelaDaPreviaDaRenegociacao::valorCentavos).sum()).isEqualTo(10_001);
        // Total igual ao número de parcelas: 1 centavo cada, sem sobra.
        assertThat(ContaDaRenegociacao.parcelas(12, 12, LocalDate.of(2027, 1, 10))).allSatisfy(x -> assertThat(x.valorCentavos()).isEqualTo(1));
        // Doze parcelas com sobra de 11: a última leva todas.
        List<ParcelaDaPreviaDaRenegociacao> doze = ContaDaRenegociacao.parcelas(1_223, 12, LocalDate.of(2027, 1, 10));
        assertThat(doze.get(0).valorCentavos()).isEqualTo(101);
        assertThat(doze.get(11).valorCentavos()).isEqualTo(1_223 - 101 * 11);
    }

    @Test
    void vencimentoParteDoPrimeiroECortaNoUltimoDiaDoMes() {
        assertThat(datas(ContaDaRenegociacao.parcelas(500, 5, LocalDate.of(2027, 1, 31))))
                .containsExactly("2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31");
        // Bissexto, e o dia 29 e 30 também cortam em fevereiro.
        assertThat(datas(ContaDaRenegociacao.parcelas(500, 2, LocalDate.of(2028, 1, 30)))).containsExactly("2028-01-30", "2028-02-29");
        assertThat(datas(ContaDaRenegociacao.parcelas(500, 2, LocalDate.of(2027, 1, 29)))).containsExactly("2027-01-29", "2027-02-28");
        // Passa a virada do ano.
        assertThat(datas(ContaDaRenegociacao.parcelas(500, 3, LocalDate.of(2027, 11, 15)))).containsExactly("2027-11-15", "2027-12-15", "2028-01-15");
    }

    @Test
    void descricaoFixaDoServidor() {
        assertThat(ContaDaRenegociacao.descricao(1, 1)).isEqualTo("Renegociação");
        assertThat(ContaDaRenegociacao.descricao(2, 12)).isEqualTo("Renegociação (Parcela 2/12)");
    }

    private static List<String> datas(List<ParcelaDaPreviaDaRenegociacao> parcelas) {
        return parcelas.stream().map(p -> p.vencimento().toString()).toList();
    }
}
