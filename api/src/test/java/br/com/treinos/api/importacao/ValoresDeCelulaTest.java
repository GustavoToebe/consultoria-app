package br.com.treinos.api.importacao;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.ValoresDeCelula.Situacao;
import br.com.treinos.api.importacao.ValoresDeCelula.SimNao;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

/** O conversor único de número, data e sim/não das duas trilhas da importação. */
class ValoresDeCelulaTest {

    private static Celula texto(String t) {
        return Celula.deTextoLido(t);
    }

    private static Celula numero(String t) {
        return new Celula(t, true, false);
    }

    private static BigDecimal valor(Celula c) {
        ValoresDeCelula.Numero n = ValoresDeCelula.numero(c);
        assertThat(n.situacao()).as(c.texto()).isEqualTo(Situacao.VALIDO);
        return n.valor();
    }

    @Test
    void numeroEscritoComUnidadeMilharEVirgula() {
        assertThat(valor(texto("80,5 kg"))).isEqualByComparingTo("80.5");
        assertThat(valor(texto("80.5"))).isEqualByComparingTo("80.5");
        assertThat(valor(texto("120 kcal"))).isEqualByComparingTo("120");
        assertThat(valor(texto("1.234,56"))).isEqualByComparingTo("1234.56");
        assertThat(valor(texto("1,234.56"))).isEqualByComparingTo("1234.56");
        assertThat(valor(texto("1.234.567"))).isEqualByComparingTo("1234567");
        assertThat(valor(texto("0.500"))).isEqualByComparingTo("0.5");
        assertThat(valor(texto("-2,5"))).isEqualByComparingTo("-2.5");
        assertThat(valor(texto("1,23457E+11"))).isEqualByComparingTo("123457000000");
        assertThat(valor(numero("45321"))).isEqualByComparingTo("45321");
        assertThat(ValoresDeCelula.numero(texto("1.500")).situacao()).isEqualTo(Situacao.AMBIGUO);
        assertThat(ValoresDeCelula.numero(texto("1.500 kg")).situacao()).isEqualTo(Situacao.AMBIGUO);
        assertThat(ValoresDeCelula.numero(texto("abc")).situacao()).isEqualTo(Situacao.INVALIDO);
        assertThat(ValoresDeCelula.numero(texto("1,2,3")).situacao()).isEqualTo(Situacao.INVALIDO);
        assertThat(ValoresDeCelula.numero(texto("")).situacao()).isEqualTo(Situacao.VAZIO);
        assertThat(ValoresDeCelula.numero(texto("x")).situacao()).isEqualTo(Situacao.VAZIO);
        assertThat(ValoresDeCelula.numero(Celula.comErro()).situacao()).isEqualTo(Situacao.COM_ERRO);
    }

    @Test
    void expoenteGiganteViraCelulaComErroSemConta() {
        assertTimeoutPreemptively(Duration.ofSeconds(1), () -> {
            for (String t : new String[] {"1E-30000000", "1E+999999999", "1" + "0".repeat(40)}) {
                assertThat(ValoresDeCelula.numero(texto(t)).situacao()).as(t).isEqualTo(Situacao.COM_ERRO);
                assertThat(ValoresDeCelula.numero(numero(t)).situacao()).as(t).isEqualTo(Situacao.COM_ERRO);
            }
            // O CSV inteiro: a célula chega como texto e o conversor recusa antes de setScale.
            byte[] csv = "aluno;data;peso\nana@exemplo.com;01/02/2026;1E-30000000\n".getBytes(StandardCharsets.UTF_8);
            Celula peso = LeitorDePlanilha.ler("pesos.csv", csv, 0).linhas().get(1).celulas().get(2);
            assertThat(ValoresDeCelula.numero(peso).situacao()).isEqualTo(Situacao.COM_ERRO);
        });
        assertThat(ValoresDeCelula.foraDoLimite(new BigDecimal("45321.541666666666666667"))).isFalse();
    }

    @Test
    void naEscalaVoltaOResiduoDoExcelENuncaArredondaODigitado() {
        assertThat(ValoresDeCelula.naEscala(new BigDecimal("81.900000000000006"), true, 2)).isEqualByComparingTo("81.9");
        assertThat(ValoresDeCelula.naEscala(new BigDecimal("81.905"), true, 2)).isNull();
        assertThat(ValoresDeCelula.naEscala(new BigDecimal("81.905"), false, 2)).isNull();
        assertThat(ValoresDeCelula.naEscala(new BigDecimal("81.900"), false, 2)).isEqualByComparingTo("81.9");
        assertThat(ValoresDeCelula.naEscala(new BigDecimal("81.9"), false, 2)).isEqualByComparingTo("81.9");
    }

    @Test
    void dataComVariacoesENumeroSoComFormatoDeData() {
        assertThat(ValoresDeCelula.data(texto("1/2/2025"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("01-02-2025"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("01.02.25"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("01/02/99"), false)).isEqualTo(LocalDate.of(1999, 2, 1));
        assertThat(ValoresDeCelula.data(texto("01/02/2025 10:30"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("01/02/2025 10:30:15"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("2025-02-01"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("2025-02-01T10:30:00"), false)).isEqualTo(LocalDate.of(2025, 2, 1));
        assertThat(ValoresDeCelula.data(texto("31/04/2026"), false)).isNull();
        assertThat(ValoresDeCelula.data(texto("01/02-2025"), false)).isNull();
        assertThat(ValoresDeCelula.data(texto("2025"), false)).isNull();
        // Número sem formato de data não é data: "2025" seria 17/07/1905.
        assertThat(ValoresDeCelula.data(numero("2025"), false)).isNull();
        assertThat(ValoresDeCelula.data(numero("45321"), false)).isNull();
        assertThat(ValoresDeCelula.data(new Celula("45321", true, false, true), false)).isEqualTo(LocalDate.of(2024, 1, 30));
        assertThat(ValoresDeCelula.data(new Celula("45321.75", true, false, true), false)).isEqualTo(LocalDate.of(2024, 1, 30));
        assertThat(ValoresDeCelula.data(Celula.comErro(), false)).isNull();
    }

    @Test
    void avisaQuandoParecemMesDiaAno() {
        assertThat(ValoresDeCelula.data(texto("03/25/2025"), false)).isNull();
        assertThat(ValoresDeCelula.pareceMesDiaAno(texto("03/25/2025"))).isTrue();
        assertThat(ValoresDeCelula.pareceMesDiaAno(texto("25/03/2025"))).isFalse();
        assertThat(ValoresDeCelula.pareceMesDiaAno(texto("03/05/2025"))).isFalse();
        assertThat(ValoresDeCelula.pareceMesDiaAno(texto("13/25/2025"))).isFalse();
    }

    @Test
    void simNaoAmpliado() {
        for (String t : new String[] {"Sim", "s", "Ativo", "ATIVA", "Verdadeiro", "true", "1"}) {
            assertThat(ValoresDeCelula.simNao(texto(t))).as(t).isEqualTo(SimNao.SIM);
        }
        for (String t : new String[] {"Não", "nao", "N", "Inativo", "inativa", "Falso", "false", "0"}) {
            assertThat(ValoresDeCelula.simNao(texto(t))).as(t).isEqualTo(SimNao.NAO);
        }
        assertThat(ValoresDeCelula.simNao(numero("1"))).isEqualTo(SimNao.SIM);
        assertThat(ValoresDeCelula.simNao(numero("0"))).isEqualTo(SimNao.NAO);
        assertThat(ValoresDeCelula.simNao(numero("2"))).isEqualTo(SimNao.INVALIDO);
        assertThat(ValoresDeCelula.simNao(texto("talvez"))).isEqualTo(SimNao.INVALIDO);
        assertThat(ValoresDeCelula.simNao(texto("x"))).isEqualTo(SimNao.VAZIO);
        assertThat(ValoresDeCelula.simNao(Celula.comErro())).isEqualTo(SimNao.INVALIDO);
    }

    @Test
    void cpfECepDigitadosComoNumeroVoltamComOsZeros() {
        assertThat(ValoresDeCelula.comZerosAEsquerda(numero("1234567890"), 11)).isEqualTo("01234567890");
        assertThat(ValoresDeCelula.comZerosAEsquerda(numero("1580000"), 8)).isEqualTo("01580000");
        assertThat(ValoresDeCelula.comZerosAEsquerda(numero("85800000"), 8)).isEqualTo("85800000");
        // Texto fica como veio: o zero que falta ali é erro de digitação, não do Excel.
        assertThat(ValoresDeCelula.comZerosAEsquerda(texto("1234567890"), 11)).isEqualTo("1234567890");
        assertThat(ValoresDeCelula.comZerosAEsquerda(texto(" 012.345.678-90 "), 11)).isEqualTo("012.345.678-90");
        assertThat(ValoresDeCelula.comZerosAEsquerda(numero("12.5"), 11)).isEqualTo("12.5");
    }
}
