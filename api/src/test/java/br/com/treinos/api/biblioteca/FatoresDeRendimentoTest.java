package br.com.treinos.api.biblioteca;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** Perfis nativos de FC e FCc. Números de exemplo, sem tabela externa. */
class FatoresDeRendimentoTest {

    @Test
    void cereaisCrusECozidos() {
        espera("Arroz branco cozido", "Cereais e derivados", "128", "1.00", "2.60");
        espera("Arroz branco", "Cereais e derivados", "128", "1.00", "2.60");
        espera("Arroz branco", "Cereais e derivados", "358", "1.00", "1.00");
        espera("Arroz, tipo 1, cru", "Cereais e derivados", "358", "1.00", "1.00");
        espera("Aveia em flocos", "Cereais e derivados", "394", "1.00", "1.00");
        espera("Aveia cozida", "Cereais e derivados", null, "1.00", "2.60");
        espera("Farinha de trigo", "Cereais e derivados", "360", "1.00", "1.00");
        espera("Quinoa cozida", null, null, "1.00", "2.60");
    }

    @Test
    void massasELeguminosas() {
        espera("Macarrão", "Cereais e derivados", "130", "1.00", "2.50");
        espera("Macarrão", "Cereais e derivados", "371", "1.00", "1.00");
        espera("Espaguete cozido", null, null, "1.00", "2.50");
        espera("Macarrão, trigo, cru", null, "371", "1.00", "1.00");
        espera("Feijão carioca", "Leguminosas e derivados", "76", "1.00", "1.85");
        espera("Feijão, carioca, cru", "Leguminosas e derivados", "329", "1.00", "1.00");
        espera("Lentilha cozida", null, null, "1.00", "1.85");
        espera("Grão-de-bico", null, "164", "1.00", "1.85");
        espera("Leite de soja", "Leite e derivados", "40", "1.00", "1.00");
    }

    @Test
    void carnesGrelhadasCozidasECruas() {
        espera("Peito de frango grelhado", "Carnes e derivados", "159", "1.12", "0.78");
        espera("Filé de frango", "Carnes e derivados", null, "1.12", "1.00");
        espera("Carne cozida", "Carnes e derivados", null, "1.12", "0.88");
        espera("Carne moída", null, null, "1.12", "0.88");
        espera("Carne moída refogada", null, null, "1.12", "0.78");
        espera("Coxa de frango assada", null, null, "1.45", "0.78");
        espera("Bacon frito", null, null, "1.00", "0.78");
        espera("Presunto", null, null, "1.00", "1.00");
        espera("Salmão, fresco", "Pescados e frutos do mar", null, "1.12", "1.00");
        espera("Tilápia grelhada", null, null, "1.12", "0.78");
    }

    @Test
    void tuberculosLegumesEFrutas() {
        espera("Batata inglesa cozida", "Verduras, hortaliças e derivados", "80", "1.25", "0.95");
        espera("Batata doce assada", null, null, "1.25", "0.82");
        espera("Cenoura, crua", null, null, "1.25", "1.00");
        espera("Abobrinha, italiana, crua", null, null, "1.25", "1.00");
        espera("Brócolis, cozido", null, null, "1.45", "0.95");
        espera("Banana prata", "Frutas e derivados", "98", "1.45", "1.00");
        espera("Abacaxi, cru", "Frutas e derivados", "48", "1.45", "1.00");
        espera("Maçã", "Frutas e derivados", null, "1.12", "1.00");
        espera("Laranja", null, null, "1.25", "1.00");
        espera("Alface, crespa, crua", null, null, "1.45", "1.00");
        espera("Legumes", null, null, "1.25", "1.00");
    }

    @Test
    void laticiniosOvosEProntos() {
        espera("Iogurte desnatado", "Leite e derivados", "36", "1.00", "1.00");
        espera("Pão de forma branco", "Cereais e derivados", "266", "1.00", "1.00");
        espera("Ovo, de galinha, inteiro, cru", "Ovos e derivados", null, "1.00", "1.00");
        espera("Ovo, de galinha, inteiro, cozido/10minutos", null, null, "1.00", "0.90");
        espera("Ovo mexido", null, null, "1.00", "0.90");
        espera("Azeite", "Gorduras e óleos", null, "1.00", "1.00");
        espera("Semente de chia", null, "500", "1.00", "1.00");
        espera("Alimento sem pista", null, "100", "1.00", "1.00");
    }

    @Test
    void completarSoPreencheOQueVeioNulo() {
        var e = FatoresDeRendimento.completar(new BigDecimal("1.75"), null, "Abacaxi", null, null, null, "g");
        assertThat(e.fatorCorrecao()).isEqualByComparingTo("1.75");
        assertThat(e.fatorCoccao()).isEqualByComparingTo("1.00");
    }

    @Test
    void kcalForaDeGramasNaoDesempata() {
        assertThat(FatoresDeRendimento.kcalPor100g(new BigDecimal("50"), new BigDecimal("200"), "ml")).isNull();
        assertThat(FatoresDeRendimento.kcalPor100g(new BigDecimal("64"), new BigDecimal("50"), "g"))
                .isEqualByComparingTo("128.00");
    }

    private static void espera(String nome, String grupo, String kcal, String fc, String fcc) {
        var e = FatoresDeRendimento.estimar(nome, grupo,
                kcal == null ? null : new BigDecimal(kcal),
                kcal == null ? null : new BigDecimal("100"),
                "g");
        assertThat(e.fatorCorrecao()).as(nome).isEqualByComparingTo(fc);
        assertThat(e.fatorCoccao()).as(nome).isEqualByComparingTo(fcc);
    }
}
