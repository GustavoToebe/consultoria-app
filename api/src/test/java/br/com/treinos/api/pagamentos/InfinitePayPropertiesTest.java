package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** A subida com a InfinitePay ligada exige as chaves de cifra e a URL pública https, e diz só o nome da variável que falta. */
class InfinitePayPropertiesTest {

    private static final String CHAVES = "k1:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=";

    private static InfinitePayProperties ligada(String urlPublica) {
        return new InfinitePayProperties(true, null, urlPublica, null);
    }

    @Test
    void padroesSemVariaveis() {
        InfinitePayProperties p = new InfinitePayProperties(false, null, null, null);

        assertThat(p.apiUrl()).isEqualTo("https://api.checkout.infinitepay.io");
        assertThat(p.urlPublica()).isEmpty();
        assertThat(p.conciliacaoAtiva()).isTrue();
        assertThat(new InfinitePayProperties(true, " https://api.exemplo.com/ ", "https://x.exemplo.com//", false).apiUrl())
                .isEqualTo("https://api.exemplo.com");
        assertThat(new InfinitePayProperties(true, null, "https://x.exemplo.com//", false).urlPublica())
                .isEqualTo("https://x.exemplo.com");
        assertThat(new InfinitePayProperties(true, null, "https://x", false).conciliacaoAtiva()).isFalse();
    }

    @Test
    void desligadaNaoExigeNada() {
        assertThatCode(() -> new InfinitePayProperties(false, null, null, null)
                .exigirCompleta(new PagamentosProperties(false, "", "", false, false))).doesNotThrowAnyException();
    }

    @Test
    void ligadaCompletaPassa() {
        assertThatCode(() -> ligada("https://api.exemplo.com.br").exigirCompleta(new PagamentosProperties(true, CHAVES, "k1", false, false)))
                .doesNotThrowAnyException();
    }

    @Test
    void ligadaFaltandoAlgoDerrubaDizendoSoOQueFalta() {
        assertThatThrownBy(() -> ligada("https://api.exemplo.com.br").exigirCompleta(new PagamentosProperties(true, "", "k1", false, false)))
                .hasMessageContaining("TREINOS_PAGAMENTOS_CHAVES").hasMessageNotContaining("k1");
        assertThatThrownBy(() -> ligada("https://api.exemplo.com.br").exigirCompleta(new PagamentosProperties(true, CHAVES, "", false, false)))
                .hasMessageContaining("TREINOS_PAGAMENTOS_CHAVE_ATIVA").hasMessageNotContaining(CHAVES);
        assertThatThrownBy(() -> ligada("").exigirCompleta(new PagamentosProperties(true, CHAVES, "k1", false, false)))
                .hasMessageContaining("TREINOS_PAGAMENTOS_URL_PUBLICA");
    }

    @Test
    void urlPublicaPrecisaSerHttpsCompleta() {
        for (String invalida : new String[] {"http://api.exemplo.com.br", "api.exemplo.com.br", "https://", "ftp://x.com", "https://a b.com"}) {
            assertThatThrownBy(() -> ligada(invalida).exigirCompleta(new PagamentosProperties(true, CHAVES, "k1", false, false)))
                    .as(invalida).isInstanceOf(IllegalStateException.class).hasMessageContaining("https");
        }
    }

    @Test
    void naoImprimeAUrlNemChaves() {
        assertThat(ligada("https://api.exemplo.com.br").toString()).doesNotContain("exemplo");
    }

    @Test
    void naSubidaAChaveGravadaPrecisaEstarNaLista() {
        assertThatCode(() -> VerificacaoDasCredenciais.conferir(List.of(), Set.of())).doesNotThrowAnyException();
        assertThatCode(() -> VerificacaoDasCredenciais.conferir(List.of("k1", "k2"), Set.of("k1", "k2", "k3")))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> VerificacaoDasCredenciais.conferir(List.of("k1", "velha"), Set.of("k1")))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("velha");
    }

    @Test
    void naSubidaADesligadaNaoConsultaONemUmaCredencial() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CifraDePagamento semChaves = new CifraDePagamento(new PagamentosProperties(false, "", "", false, false));

        assertThatCode(() -> new VerificacaoDasCredenciais(jdbc, semChaves, new InfinitePayProperties(false, null, null, null))
                .run(null)).doesNotThrowAnyException();

        verifyNoInteractions(jdbc);
    }

    @Test
    void naSubidaALigadaDerrubaComCredencialDeChaveDesconhecida() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), eq(String.class))).thenReturn(List.of("velha"));
        CifraDePagamento semChaves = new CifraDePagamento(new PagamentosProperties(false, "", "", false, false));

        assertThatThrownBy(() -> new VerificacaoDasCredenciais(jdbc, semChaves,
                new InfinitePayProperties(true, null, "https://api.exemplo.com.br", null)).run(null))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("velha");
    }
}
