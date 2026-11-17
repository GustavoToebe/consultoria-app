package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Paridade com {@code app/src/dominio/kcalDosMacros.test.ts}: os mesmos casos, na mesma ordem. Se um lado mudar, o outro
 * precisa mudar junto. Macro negativo: o app devolve nulo e a API o recusa no DTO ({@code @DecimalMin("0")}), por isso
 * aqui o caso confere a recusa do DTO e não o método.
 */
class KcalDosMacrosParidadeTest {

    private static BigDecimal bd(String v) {
        return v == null ? null : new BigDecimal(v);
    }

    private static void confere(String p, String c, String g, String esperado) {
        assertThat(BibliotecaService.kcalDosMacros(bd(p), bd(c), bd(g))).isEqualByComparingTo(esperado);
    }

    @Test
    void somaProteinaVezesQuatroCarboidratoVezesQuatroEGorduraVezesNove() {
        confere("100", "0", "0", "400");
        confere("0", "0", "100", "900");
        confere("2.5", "28.1", "0.2", "124.2");
    }

    @Test
    void semRuidoDePontoFlutuante() {
        confere("0.9", "12.3", "0.1", "53.7");
        confere("0.1", "0.2", "0.3", "3.9");
    }

    @Test
    void zeroEUmValorTudoZeradoDaZeroENaoNulo() {
        confere("0", "0", "0", "0");
    }

    @Test
    void qualquerMacroNuloDaNulo() {
        assertThat(BibliotecaService.kcalDosMacros(null, bd("10"), bd("1"))).isNull();
        assertThat(BibliotecaService.kcalDosMacros(bd("10"), null, bd("1"))).isNull();
        assertThat(BibliotecaService.kcalDosMacros(bd("10"), bd("10"), null)).isNull();
    }

    private static BigDecimal alimento(String p, String c, String g, String gravada) {
        return BibliotecaService.kcalDoAlimento(bd(p), bd(c), bd(g), bd(gravada));
    }

    // D15 (macros opcionais): os mesmos casos de kcalDoAlimento em kcalDosMacros.test.ts, na mesma ordem.
    @Test
    void comOsTresMacrosRecalculaMesmoComKcalGravada() {
        assertThat(alimento("100", "0", "0", "321.5")).isEqualByComparingTo("400");
        assertThat(alimento("2.5", "28.1", "0.2", null)).isEqualByComparingTo("124.2");
    }

    @Test
    void comUmDoisOuNenhumMacroMantemAKcalGravada() {
        assertThat(alimento("10", "20", null, "321.5")).isEqualByComparingTo("321.5");
        assertThat(alimento("10", null, null, "321.5")).isEqualByComparingTo("321.5");
        assertThat(alimento(null, null, null, "321.5")).isEqualByComparingTo("321.5");
        assertThat(alimento("0", null, null, "321.5")).isEqualByComparingTo("321.5");
    }

    @Test
    void semMacrosESemKcalGravadaENuloNuncaZero() {
        assertThat(alimento(null, null, null, null)).isNull();
        assertThat(alimento("10", null, "1", null)).isNull();
    }

    @Test
    void zeroZeroZeroDigitadoDePropositoDaZeroENaoAKcalGravada() {
        assertThat(alimento("0", "0", "0", "321.5")).isEqualByComparingTo("0");
        assertThat(alimento("0", "0", "0", null)).isEqualByComparingTo("0");
    }

    @Test
    void macroNegativoERecusadoPeloDtoDaApi() {
        try (var fabrica = Validation.buildDefaultValidatorFactory()) {
            var validador = fabrica.getValidator();
            assertThat(validador.validate(pedido("-10", "10", "1"))).extracting(v -> v.getPropertyPath().toString())
                    .containsExactly("proteina");
            assertThat(validador.validate(pedido("10", "10", "-0.1"))).extracting(v -> v.getPropertyPath().toString())
                    .containsExactly("gordura");
            assertThat(validador.validate(pedido("10", "10", "1"))).isEmpty();
        }
    }

    private static AlimentoRequest pedido(String p, String c, String g) {
        return new AlimentoRequest("Alimento fictício", new BigDecimal("100"), "g", null, bd(p), bd(c), bd(g), null, null,
                null, null, null, null, null, null, null, null, null, null);
    }
}
