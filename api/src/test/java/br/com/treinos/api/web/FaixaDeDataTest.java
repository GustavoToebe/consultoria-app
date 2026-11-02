package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ApiError;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A regra pura das faixas de data (C76), sem banco. O espelho no app é {@code datasValidas.test.ts}: mesmas bordas. */
class FaixaDeDataTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 2);

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    @Test
    void planejamentoVaiDe2000AteODiaUltimoDoAnoMaisCinco() {
        assertThat(FaixaDeData.PLANEJAMENTO.minimo()).isEqualTo(d("2000-01-01"));
        assertThat(FaixaDeData.PLANEJAMENTO.maximo(HOJE)).isEqualTo(d("2031-12-31"));
        assertThat(FaixaDeData.PLANEJAMENTO.aceita(d("2000-01-01"), HOJE)).isTrue();
        assertThat(FaixaDeData.PLANEJAMENTO.aceita(d("1999-12-31"), HOJE)).isFalse();
        assertThat(FaixaDeData.PLANEJAMENTO.aceita(d("2031-12-31"), HOJE)).isTrue();
        assertThat(FaixaDeData.PLANEJAMENTO.aceita(d("2032-01-01"), HOJE)).isFalse();
        assertThat(FaixaDeData.PLANEJAMENTO.aceita(d("0261-05-05"), HOJE)).isFalse();
    }

    @Test
    void registroVaiDe1900AteHojeSemFuturo() {
        assertThat(FaixaDeData.REGISTRO.minimo()).isEqualTo(d("1900-01-01"));
        assertThat(FaixaDeData.REGISTRO.maximo(HOJE)).isEqualTo(HOJE);
        assertThat(FaixaDeData.REGISTRO.aceita(d("1900-01-01"), HOJE)).isTrue();
        assertThat(FaixaDeData.REGISTRO.aceita(d("1899-12-31"), HOJE)).isFalse();
        assertThat(FaixaDeData.REGISTRO.aceita(HOJE, HOJE)).isTrue();
        assertThat(FaixaDeData.REGISTRO.aceita(HOJE.plusDays(1), HOJE)).isFalse();
    }

    @Test
    void dataComFuturoVaiDe1900AteOFimDoAnoMaisCinco() {
        assertThat(FaixaDeData.DATA_COM_FUTURO.maximo(HOJE)).isEqualTo(d("2031-12-31"));
        assertThat(FaixaDeData.DATA_COM_FUTURO.aceita(d("1960-03-10"), HOJE)).isTrue();
        assertThat(FaixaDeData.DATA_COM_FUTURO.aceita(d("2032-01-01"), HOJE)).isFalse();
        assertThat(FaixaDeData.DATA_COM_FUTURO.aceita(d("1899-12-31"), HOJE)).isFalse();
    }

    @Test
    void aFaixaAcompanhaOAnoDeHoje() {
        assertThat(FaixaDeData.PLANEJAMENTO.maximo(d("2026-12-31"))).isEqualTo(d("2031-12-31"));
        assertThat(FaixaDeData.PLANEJAMENTO.maximo(d("2027-01-01"))).isEqualTo(d("2032-12-31"));
    }

    @Test
    void aMensagemNomeiaOCampoEAFaixa() {
        assertThat(FaixaDeData.PLANEJAMENTO.mensagem("Início da pasta", HOJE))
                .isEqualTo("Início da pasta: use uma data entre 01/01/2000 e 31/12/2031");
        assertThat(FaixaDeData.REGISTRO.mensagem("Data do peso", HOJE))
                .isEqualTo("Data do peso: use uma data entre 01/01/1900 e hoje");
    }

    @Test
    void exigirLancaOCampoSemRepetirOValorEIgnoraNulo() {
        var ruim = FaixaDeData.PLANEJAMENTO.campo("inicio", "Início da pasta", d("0260-11-01"));
        var nulo = FaixaDeData.PLANEJAMENTO.campo("fim", "Fim da pasta", null);
        var certo = FaixaDeData.PLANEJAMENTO.campo("outro", "Outro", d("2026-11-01"));
        assertThatThrownBy(() -> FaixaDeData.exigir(HOJE, "PERIODO_INVALIDO", ruim, nulo, certo))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                    assertThat(e.getCodigo()).isEqualTo("PERIODO_INVALIDO");
                    assertThat(e.getProblemas()).extracting(ApiError.FieldError::field).containsExactly("inicio");
                    assertThat(e.getMessage()).doesNotContain("0260");
                    assertThat(e.getProblemas().toString()).doesNotContain("0260");
                });
        assertThatCode(() -> FaixaDeData.exigir(HOJE, "PERIODO_INVALIDO", nulo, certo)).doesNotThrowAnyException();
    }

    @Test
    void problemasListaUmErroPorCampoForaDaFaixa() {
        List<ApiError.FieldError> erros = FaixaDeData.problemas(HOJE,
                FaixaDeData.REGISTRO.campo("dataInicio", "Início da lesão", d("1899-12-31")),
                FaixaDeData.REGISTRO.campo("dataFim", "Fim da lesão", HOJE.plusDays(1)));
        assertThat(erros).extracting(ApiError.FieldError::field).containsExactly("dataInicio", "dataFim");
    }
}
