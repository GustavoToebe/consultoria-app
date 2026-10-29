package br.com.treinos.api.avaliacoes;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoRequest;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.Medidas;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras da avaliação física sem banco. Os mesmos casos estão em {@code app/src/dominio/avaliacaoFisica.test.ts}. */
class ValidacaoDaAvaliacaoTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 28);

    private static Medidas cintura(String valor) {
        return new Medidas(null, null, null, valor == null ? null : new BigDecimal(valor), null, null, null, null, null, null);
    }

    private static List<String> campos(AvaliacaoRequest r) {
        return ValidacaoDaAvaliacao.problemas(r, HOJE).stream().map(ApiError.FieldError::field).toList();
    }

    @Test
    void aceitaUmaMedidaComUmaCasaEHoje() {
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("80.5"), null, null))).isEmpty();
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("5"), null, null))).isEmpty();
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("300.0"), null, null))).isEmpty();
        // Zeros à direita não contam como casa decimal.
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("80.50"), null, null))).isEmpty();
    }

    @Test
    void dataObrigatoriaNaoFuturaNemAntiga() {
        assertThat(campos(new AvaliacaoRequest(null, cintura("80"), null, null))).containsExactly("data");
        assertThat(campos(new AvaliacaoRequest(HOJE.plusDays(1), cintura("80"), null, null))).containsExactly("data");
        assertThat(campos(new AvaliacaoRequest(LocalDate.of(1899, 12, 31), cintura("80"), null, null))).containsExactly("data");
    }

    @Test
    void aoMenosUmaMedidaNaFaixaEComUmaCasa() {
        assertThat(campos(new AvaliacaoRequest(HOJE, null, null, null))).containsExactly("medidas");
        assertThat(campos(new AvaliacaoRequest(HOJE, Medidas.VAZIAS, null, null))).containsExactly("medidas");
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("4.9"), null, null))).containsExactly("medidas.cintura");
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("300.1"), null, null))).containsExactly("medidas.cintura");
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("0"), null, null))).containsExactly("medidas.cintura");
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("80.25"), null, null))).containsExactly("medidas.cintura");
    }

    @Test
    void observacaoAteMilDepoisDoStrip() {
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("80"), " " + "x".repeat(1000) + " ", null))).isEmpty();
        assertThat(campos(new AvaliacaoRequest(HOJE, cintura("80"), "x".repeat(1001), null))).containsExactly("observacao");
    }

    @Test
    void mensagensNaoRepetemOValor() {
        var problemas = ValidacaoDaAvaliacao.problemas(new AvaliacaoRequest(HOJE, cintura("123.45"), null, null), HOJE);
        assertThat(problemas.toString()).doesNotContain("123");
    }

    @Test
    void normalizaParaUmaCasaEObservacaoVaziaViraNula() {
        var valida = ValidacaoDaAvaliacao.normalizar(new AvaliacaoRequest(HOJE, cintura("80"), "   ", null));
        assertThat(valida.medidas().cintura()).isEqualTo(new BigDecimal("80.0"));
        assertThat(valida.medidas().quadril()).isNull();
        assertThat(valida.observacao()).isNull();
        assertThat(ValidacaoDaAvaliacao.normalizar(new AvaliacaoRequest(HOJE, cintura("80.50"), " obs ", null)).observacao())
                .isEqualTo("obs");
    }
}
