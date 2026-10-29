package br.com.treinos.api.anteriores;

import br.com.treinos.api.anteriores.SeriesAnteriores.AnteriorDoExercicio;
import br.com.treinos.api.anteriores.SeriesAnteriores.Feita;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.EtapaRegistrada;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regra da coluna "Anterior" (Engajamento 0.3), sem banco; o espelho do app é {@code dominio/seriesAnteriores.test.ts}. */
class SeriesAnterioresTest {

    private static final UUID SUPINO = UUID.randomUUID();
    private static final UUID LINHA_A = UUID.randomUUID();
    private static final UUID LINHA_C = UUID.randomUUID();
    private static final LocalDate DIA_1 = LocalDate.of(2026, 10, 20);
    private static final LocalDate DIA_2 = LocalDate.of(2026, 10, 23);

    private static Feita feita(LocalDate data, UUID linha, int ordemNoPlano, String tipo, int ordemNoTipo, String carga, Integer reps) {
        return new Feita(SUPINO, data, linha, ordemNoPlano, tipo, ordemNoTipo, carga == null ? null : new BigDecimal(carga), reps, null);
    }

    @Test
    void valeADataMaisRecenteComAsSeriesNaOrdemDoPlano() {
        Map<UUID, AnteriorDoExercicio> r = SeriesAnteriores.escolher(List.of(
                feita(DIA_1, LINHA_A, 1, "WORKING", 1, "50", 10),
                feita(DIA_2, LINHA_A, 2, "WORKING", 2, "62.5", 8),
                feita(DIA_2, LINHA_A, 1, "WORKING", 1, "60", 10)));
        AnteriorDoExercicio a = r.get(SUPINO);
        assertThat(a.data()).isEqualTo(DIA_2);
        assertThat(a.series()).extracting(SeriesAnteriores.SerieAnterior::ordem).containsExactly(1, 2);
        assertThat(a.series().get(0).carga()).isEqualByComparingTo("60");
        assertThat(a.series().get(1).repeticoes()).isEqualTo(8);
    }

    @Test
    void exercicioEmDuasLinhasNoMesmoDiaUsaAPrimeiraDoPlano() {
        Map<UUID, AnteriorDoExercicio> r = SeriesAnteriores.escolher(List.of(
                feita(DIA_2, LINHA_C, 9, "WORKING", 1, "40", 12),
                feita(DIA_2, LINHA_A, 3, "WORKING", 1, "60", 10)));
        assertThat(r.get(SUPINO).series()).hasSize(1);
        assertThat(r.get(SUPINO).series().get(0).carga()).isEqualByComparingTo("60");
    }

    @Test
    void serieSemTipoComoOCardioNaoEntra() {
        assertThat(SeriesAnteriores.escolher(List.of(feita(DIA_2, LINHA_A, 1, null, 0, null, null)))).isEmpty();
    }

    @Test
    void semCargaEComEtapasVaiComoFoiRegistrado() {
        List<EtapaRegistrada> etapas = List.of(new EtapaRegistrada(1, 4, new BigDecimal("40"), "FEITA"),
                new EtapaRegistrada(2, 2, new BigDecimal("40"), "FEITA"));
        Map<UUID, AnteriorDoExercicio> r = SeriesAnteriores.escolher(List.of(
                new Feita(SUPINO, DIA_2, LINHA_A, 1, "WORKING", 1, new BigDecimal("40"), 6, etapas),
                feita(DIA_2, LINHA_A, 2, "BACK_OFF", 1, null, 15)));
        assertThat(r.get(SUPINO).series().get(0).etapas()).hasSize(2);
        assertThat(r.get(SUPINO).series().get(1).carga()).isNull();
        assertThat(r.get(SUPINO).series().get(1).repeticoes()).isEqualTo(15);
    }
}
