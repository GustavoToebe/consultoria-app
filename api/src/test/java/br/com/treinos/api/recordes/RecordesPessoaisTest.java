package br.com.treinos.api.recordes;

import br.com.treinos.api.recordes.RecordesPessoais.Marca;
import br.com.treinos.api.recordes.RecordesPessoais.Melhores;
import br.com.treinos.api.recordes.RecordesPessoais.Recorde;
import br.com.treinos.api.recordes.RecordesPessoais.RepeticoesNaCarga;
import br.com.treinos.api.recordes.RecordesPessoais.Tipo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regra pura dos recordes pessoais (Engajamento 0.2), sem banco. Os mesmos casos estão em
 * {@code app/src/dominio/recordesPessoais.test.ts}: os dois lados têm de dar o mesmo resultado.
 */
class RecordesPessoaisTest {

    private static Marca m(String carga, int reps) {
        return new Marca(new BigDecimal(carga), reps);
    }

    private static List<Tipo> tipos(List<Recorde> recordes) {
        return recordes.stream().map(Recorde::tipo).toList();
    }

    @Test
    void melhoresJuntamMaiorCargaMaiorVolumeERepeticoesPorCargaSemDependerDaOrdem() {
        Melhores a = RecordesPessoais.melhores(List.of(m("60", 10), m("70", 5), m("60", 12), m("60.00", 8)));
        Melhores b = RecordesPessoais.melhores(List.of(m("60.00", 8), m("60", 12), m("70", 5), m("60", 10)));
        assertThat(a.maiorCarga()).isEqualByComparingTo("70");
        assertThat(a.maiorVolume()).isEqualByComparingTo("720");
        // 60 e 60.00 são a mesma carga: uma linha só, com o máximo de repetições.
        assertThat(a.repeticoesPorCarga()).hasSize(2);
        assertThat(a.repeticoesPorCarga().get(0).carga()).isEqualByComparingTo("60");
        assertThat(a.repeticoesPorCarga().get(0).repeticoes()).isEqualTo(12);
        assertThat(a.repeticoesPorCarga().get(1).repeticoes()).isEqualTo(5);
        assertThat(b.maiorCarga()).isEqualByComparingTo(a.maiorCarga());
        assertThat(b.maiorVolume()).isEqualByComparingTo(a.maiorVolume());
        assertThat(b.repeticoesPorCarga().stream().map(RepeticoesNaCarga::repeticoes)).containsExactly(12, 5);
        assertThat(RecordesPessoais.melhores(List.of())).isNull();
    }

    @Test
    void osTresTiposEEmpateNaoEhRecorde() {
        Melhores base = RecordesPessoais.melhores(List.of(m("60", 10), m("70", 5)));
        // 72,5 kg × 4: maior carga (290 de volume não bate 600).
        assertThat(tipos(RecordesPessoais.recordes(base, m("72.5", 4)))).containsExactly(Tipo.MAIOR_CARGA);
        // 60 kg × 11: mais repetições com 60 e maior volume (660 > 600).
        assertThat(tipos(RecordesPessoais.recordes(base, m("60", 11)))).containsExactly(Tipo.MAIS_REPETICOES, Tipo.MAIOR_VOLUME);
        // 70 kg × 6: mais repetições com 70 (420 de volume não bate 600).
        assertThat(tipos(RecordesPessoais.recordes(base, m("70", 6)))).containsExactly(Tipo.MAIS_REPETICOES);
        // Carga nova abaixo da maior: não é "mais repetições" (não há nada com 50 kg antes), só volume se bater.
        assertThat(tipos(RecordesPessoais.recordes(base, m("50", 13)))).containsExactly(Tipo.MAIOR_VOLUME);
        // Tudo igual ao melhor: nada.
        assertThat(RecordesPessoais.recordes(base, m("70", 5))).isEmpty();
        assertThat(RecordesPessoais.recordes(base, m("60", 10))).isEmpty();
        // Carga e reps maiores: os três.
        assertThat(tipos(RecordesPessoais.recordes(base, m("70", 9)))).containsExactly(Tipo.MAIS_REPETICOES, Tipo.MAIOR_VOLUME);
        assertThat(tipos(RecordesPessoais.recordes(base, m("75", 9)))).containsExactly(Tipo.MAIOR_CARGA, Tipo.MAIOR_VOLUME);
    }

    @Test
    void oValorDeCadaRecordeEhOQueBateu() {
        Melhores base = RecordesPessoais.melhores(List.of(m("60", 10)));
        List<Recorde> r = RecordesPessoais.recordes(base, m("62.5", 10));
        assertThat(tipos(r)).containsExactly(Tipo.MAIOR_CARGA, Tipo.MAIOR_VOLUME);
        assertThat(r.get(0).valor()).isEqualByComparingTo("62.5");
        assertThat(r.get(1).valor()).isEqualByComparingTo("625");
        assertThat(r.get(1).carga()).isEqualByComparingTo("62.5");
        assertThat(r.get(1).repeticoes()).isEqualTo(10);
    }

    @Test
    void semHistoricoNaoHaRecordeOPrimeiroRegistroNaoConta() {
        assertThat(RecordesPessoais.recordes(null, m("100", 10))).isEmpty();
        assertThat(RecordesPessoais.doDia(null, List.of(m("50", 10), m("55", 10)))).containsExactly(List.of(), List.of());
    }

    @Test
    void noDiaCadaSerieComparaComOHistoricoEAsAnterioresDoMesmoDia() {
        Melhores base = RecordesPessoais.melhores(List.of(m("60", 10)));
        List<List<Recorde>> dia = RecordesPessoais.doDia(base, Arrays.asList(m("65", 8), null, m("65", 8), m("67.5", 6), m("65", 9)));
        assertThat(tipos(dia.get(0))).containsExactly(Tipo.MAIOR_CARGA);
        // Série que não conta (com técnica, sem carga...) não tem recorde nem muda a base.
        assertThat(dia.get(1)).isEmpty();
        // Igual à primeira do dia: nada.
        assertThat(dia.get(2)).isEmpty();
        assertThat(tipos(dia.get(3))).containsExactly(Tipo.MAIOR_CARGA);
        assertThat(tipos(dia.get(4))).containsExactly(Tipo.MAIS_REPETICOES);
    }

    @Test
    void contaSoComCargaERepeticoesMaioresQueZero() {
        assertThat(RecordesPessoais.conta(new BigDecimal("20"), 8)).isTrue();
        assertThat(RecordesPessoais.conta(BigDecimal.ZERO, 8)).isFalse();
        assertThat(RecordesPessoais.conta(new BigDecimal("20"), 0)).isFalse();
        assertThat(RecordesPessoais.conta(null, 8)).isFalse();
        assertThat(RecordesPessoais.conta(new BigDecimal("20"), null)).isFalse();
    }
}
