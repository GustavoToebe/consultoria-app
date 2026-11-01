package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Leitura dos filtros da fila de interessados, sem banco. */
class FiltrosDaFilaTest {

    @Test
    void responsaveisEOrigensRepetiveis() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        FiltrosDaFila f = FiltrosDaFila.ler(null, List.of(a.toString(), b.toString(), "nenhum"),
                List.of("instagram", "NAO_INFORMADA", "GOOGLE"), " maria ", null, null, null, null);
        assertThat(f.responsaveis()).containsExactlyInAnyOrder(a, b);
        assertThat(f.semResponsavel()).isTrue();
        assertThat(f.origens()).containsExactlyInAnyOrder(Crm.Origem.INSTAGRAM, Crm.Origem.GOOGLE);
        assertThat(f.semOrigem()).isTrue();
        assertThat(f.busca()).isEqualTo("maria");
    }

    @Test
    void meusViraOProprioIdEJuntoDeResponsavelEhRecusado() {
        UUID eu = UUID.randomUUID();
        FiltrosDaFila f = FiltrosDaFila.ler(eu, null, null, null, null, null, null, null);
        assertThat(f.responsaveis()).containsExactly(eu);
        assertThatThrownBy(() -> FiltrosDaFila.ler(eu, List.of("nenhum"), null, null, null, null, null, null))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo("FILTRO_INVALIDO"));
    }

    @Test
    void valorDesconhecidoNaoERepetido() {
        assertThatThrownBy(() -> FiltrosDaFila.ler(null, null, List.of("TELEVISAO"), null, null, null, null, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageNotContaining("TELEVISAO")
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo("FILTRO_INVALIDO"));
        assertThatThrownBy(() -> FiltrosDaFila.ler(null, List.of("ninguem"), null, null, null, null, null, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void periodosEmDiasDeBrasiliaComPontasInclusivas() {
        LocalDate dia = LocalDate.of(2026, 10, 15);
        FiltrosDaFila f = FiltrosDaFila.ler(null, null, null, null, dia, dia, null, dia);
        // 15/10 em Brasília (UTC-3): de 03:00Z do dia 15 até 03:00Z do dia 16 (fim exclusivo).
        assertThat(f.entrada().inicio()).isEqualTo(Instant.parse("2026-10-15T03:00:00Z"));
        assertThat(f.entrada().fim()).isEqualTo(Instant.parse("2026-10-16T03:00:00Z"));
        assertThat(f.atividade().inicio()).isNull();
        assertThat(f.atividade().fim()).isEqualTo(Instant.parse("2026-10-16T03:00:00Z"));
        assertThatThrownBy(() -> FiltrosDaFila.ler(null, null, null, null, dia, dia.minusDays(1), null, null))
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo("PERIODO_INVALIDO"));
        assertThatThrownBy(() -> FiltrosDaFila.ler(null, null, null, null, null, null, dia, dia.minusDays(1)))
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo("PERIODO_INVALIDO"));
    }

    @Test
    void digitosDoWhatsapp() {
        assertThat(FiltrosDaFila.digitos("+55 (11) 98765-0001")).isEqualTo("11987650001");
        assertThat(FiltrosDaFila.digitos("123")).isEmpty();
        assertThat(FiltrosDaFila.digitos("maria")).isEmpty();
    }
}
