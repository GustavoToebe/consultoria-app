package br.com.treinos.api.web;

import br.com.plataforma.comum.web.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Leitura dos filtros repetíveis das listas, sem banco (lote 2 de {@code docs/planos/filtros-nas-listas.md}). */
class FiltrosDeListaTest {

    private enum Cor { AZUL, VERDE }

    @Test
    void valoresTiramVaziosEspacosERepetidos() {
        assertThat(FiltrosDeLista.valores(null, "x")).isEmpty();
        assertThat(FiltrosDeLista.valores(Arrays.asList(" a ", "", null, "b", "a"), "x")).containsExactly("a", "b");
    }

    @Test
    void maisDeCinquentaValoresEhRecusado() {
        List<String> muitos = new ArrayList<>();
        for (int i = 0; i < 51; i++) muitos.add("v" + i);
        assertThatThrownBy(() -> FiltrosDeLista.valores(muitos, "acao"))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo(FiltrosDeLista.CODIGO));
        assertThat(FiltrosDeLista.valores(muitos.subList(0, 50), "acao")).hasSize(50);
    }

    @Test
    void enumSemDiferencaDeCaixaEValorDesconhecidoSemRepetirOValor() {
        assertThat(FiltrosDeLista.enums(Cor.class, List.of("azul", "VERDE"), "cor")).containsExactlyInAnyOrder(Cor.AZUL, Cor.VERDE);
        assertThat(FiltrosDeLista.umEnum(Cor.class, "  ", "cor")).isNull();
        assertThatThrownBy(() -> FiltrosDeLista.umEnum(Cor.class, "<script>roxo", "cor"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageNotContaining("roxo")
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo(FiltrosDeLista.CODIGO));
    }

    @Test
    void responsaveis() {
        UUID id = UUID.randomUUID();
        var r = FiltrosDeLista.Responsaveis.ler(List.of(id.toString(), "NENHUM"), false);
        assertThat(r.ids()).containsExactly(id);
        assertThat(r.semResponsavel()).isTrue();
        assertThat(r.aceita(id)).isTrue();
        assertThat(r.aceita(null)).isTrue();
        assertThat(r.aceita(UUID.randomUUID())).isFalse();

        var nenhum = FiltrosDeLista.Responsaveis.ler(null, true);
        assertThat(nenhum.filtra()).isFalse();
        assertThat(nenhum.aceita(UUID.randomUUID())).isTrue();

        assertThatThrownBy(() -> FiltrosDeLista.Responsaveis.ler(List.of(id.toString()), true))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo(FiltrosDeLista.CODIGO));
        assertThatThrownBy(() -> FiltrosDeLista.Responsaveis.ler(List.of("ninguem"), false))
                .isInstanceOf(BadRequestException.class)
                .hasMessageNotContaining("ninguem");
    }

    @Test
    void periodo() {
        LocalDate hoje = LocalDate.of(2026, 11, 1);
        FiltrosDeLista.exigirPeriodo(null, null, 10, "P");
        FiltrosDeLista.exigirPeriodo(hoje, hoje, 10, "P");
        FiltrosDeLista.exigirPeriodo(hoje, hoje.plusDays(9), 10, "P");
        FiltrosDeLista.exigirPeriodo(hoje, hoje.plusDays(5000), 0, "P");
        assertThatThrownBy(() -> FiltrosDeLista.exigirPeriodo(hoje, hoje.minusDays(1), 0, "P"))
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo("P"));
        assertThatThrownBy(() -> FiltrosDeLista.exigirPeriodo(hoje, hoje.plusDays(10), 10, "P"))
                .satisfies(e -> assertThat(((BadRequestException) e).getCodigo()).isEqualTo("P"));
    }
}
