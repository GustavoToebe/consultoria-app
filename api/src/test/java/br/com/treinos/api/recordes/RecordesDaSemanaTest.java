package br.com.treinos.api.recordes;

import br.com.treinos.api.recordes.RecordesDaSemana.ComRecorde;
import br.com.treinos.api.recordes.RecordesDaSemana.SerieDoPeriodo;
import br.com.treinos.api.recordes.RecordesPessoais.Marca;
import br.com.treinos.api.recordes.RecordesPessoais.Tipo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Recordes da semana (Engajamento 0.5): a regra do aluno aplicada dia a dia no período, sem banco. */
class RecordesDaSemanaTest {

    private static final LocalDate SEG = LocalDate.of(2026, 10, 19);
    private static final LocalDate QUA = SEG.plusDays(2);

    private static SerieDoPeriodo<String> s(LocalDate data, int ordem, String carga, int reps, String nome) {
        return new SerieDoPeriodo<>(data, ordem, new Marca(new BigDecimal(carga), reps), nome);
    }

    @Test
    void comHistoricoCadaDiaComparaComOQueVeioAntesNaOrdemDoPlano() {
        var base = RecordesPessoais.melhores(List.of(new Marca(new BigDecimal("60"), 10)));
        List<ComRecorde<String>> r = RecordesDaSemana.doPeriodo(base, List.of(
                s(QUA, 1, "65", 10, "qua-1"),
                // Na segunda, a 2ª série (62,5 × 10) bate; a 1ª (60 × 8) não. Fora de ordem na lista, a ordem do plano vale.
                s(SEG, 2, "62.5", 10, "seg-2"),
                s(SEG, 1, "60", 8, "seg-1")));
        assertThat(r).extracting(ComRecorde::origem).containsExactly("seg-2", "qua-1");
        assertThat(r.get(0).recordes()).extracting(RecordesPessoais.Recorde::tipo).containsExactly(Tipo.MAIOR_CARGA, Tipo.MAIOR_VOLUME);
    }

    @Test
    void semHistoricoOPrimeiroDiaNaoContaEOsSeguintesComparamComEle() {
        List<ComRecorde<String>> r = RecordesDaSemana.doPeriodo(null, List.of(
                s(SEG, 1, "50", 10, "seg"),
                s(QUA, 1, "50", 10, "qua-empate"),
                s(QUA, 2, "52.5", 10, "qua-maior")));
        assertThat(r).extracting(ComRecorde::origem).containsExactly("qua-maior");
    }

    @Test
    void serieQueNaoContaNaoERecordeNemMudaABase() {
        var base = RecordesPessoais.melhores(List.of(new Marca(new BigDecimal("60"), 10)));
        List<ComRecorde<String>> r = RecordesDaSemana.doPeriodo(base, List.of(
                new SerieDoPeriodo<>(SEG, 1, null, "drop-set"),
                s(SEG, 2, "61", 10, "seg")));
        assertThat(r).extracting(ComRecorde::origem).containsExactly("seg");
    }
}
