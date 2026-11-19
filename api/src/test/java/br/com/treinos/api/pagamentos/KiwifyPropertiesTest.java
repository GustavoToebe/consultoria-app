package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * A subida com a Kiwify ligada exige as chaves de cifra e a URL pública https (as mesmas da InfinitePay) e a URL da API da
 * Kiwify em https, e diz só o NOME da variável que falta. Desligada, a subida não exige nada. É o teste de "a API não sobe":
 * {@code PagamentosConfiguracao} chama {@code exigirCompleta} no construtor, antes de qualquer rota.
 */
class KiwifyPropertiesTest {

    private static final String CHAVES = "k1:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=";
    private static final PagamentosProperties COMPLETAS = new PagamentosProperties(true, CHAVES, "k1", false, false);

    private static InfinitePayProperties infinitePay(String urlPublica) {
        return new InfinitePayProperties(false, null, urlPublica, null);
    }

    private static KiwifyProperties ligada(String urlApi) {
        return new KiwifyProperties(true, urlApi, null);
    }

    @Test
    void aConfiguracaoDaSubidaRecusaAKiwifyLigadaSemAsVariaveis() {
        PagamentosInterceptor interceptor = mock(PagamentosInterceptor.class);
        PagamentosProperties semChaves = new PagamentosProperties(true, "", "", false, false);

        assertThatThrownBy(() -> new PagamentosConfiguracao(interceptor, semChaves, infinitePay(""), ligada(null)))
                .hasMessageContaining("TREINOS_PAGAMENTOS_CHAVES");
        assertThatThrownBy(() -> new PagamentosConfiguracao(interceptor, COMPLETAS, infinitePay(""), ligada(null)))
                .hasMessageContaining("TREINOS_PAGAMENTOS_URL_PUBLICA");
        assertThatCode(() -> new PagamentosConfiguracao(interceptor, COMPLETAS, infinitePay("https://api.exemplo.com.br"),
                ligada(null))).doesNotThrowAnyException();
        assertThatCode(() -> new PagamentosConfiguracao(interceptor, new PagamentosProperties(false, "", "", false, false),
                infinitePay(""), new KiwifyProperties(false, null, null))).doesNotThrowAnyException();
    }

    @Test
    void padroes() {
        KiwifyProperties p = new KiwifyProperties(false, null, null);

        assertThat(p.habilitado()).isFalse();
        assertThat(p.urlApi()).isEqualTo("https://public-api.kiwify.com");
        assertThat(p.conciliacaoAtiva()).isTrue();
        assertThat(new KiwifyProperties(true, " https://api.exemplo.com// ", false).urlApi()).isEqualTo("https://api.exemplo.com");
        assertThat(new KiwifyProperties(true, null, false).conciliacaoAtiva()).isFalse();
    }

    @Test
    void desligadaNaoExigeNada() {
        assertThatCode(() -> new KiwifyProperties(false, null, null)
                .exigirCompleta(new PagamentosProperties(false, "", "", false, false), infinitePay(""))).doesNotThrowAnyException();
    }

    @Test
    void ligadaCompletaPassa() {
        assertThatCode(() -> ligada(null).exigirCompleta(COMPLETAS, infinitePay("https://api.exemplo.com.br")))
                .doesNotThrowAnyException();
    }

    @Test
    void ligadaFaltandoAlgoDerrubaDizendoSoOQueFalta() {
        assertThatThrownBy(() -> ligada(null).exigirCompleta(new PagamentosProperties(true, "", "k1", false, false),
                infinitePay("https://api.exemplo.com.br"))).hasMessageContaining("TREINOS_PAGAMENTOS_CHAVES").hasMessageNotContaining("k1");
        assertThatThrownBy(() -> ligada(null).exigirCompleta(new PagamentosProperties(true, CHAVES, "", false, false),
                infinitePay("https://api.exemplo.com.br"))).hasMessageContaining("TREINOS_PAGAMENTOS_CHAVE_ATIVA")
                .hasMessageNotContaining(CHAVES);
        assertThatThrownBy(() -> ligada(null).exigirCompleta(COMPLETAS, infinitePay("")))
                .hasMessageContaining("TREINOS_PAGAMENTOS_URL_PUBLICA");
    }

    @Test
    void urlPublicaPrecisaSerHttpsCompleta() {
        for (String invalida : new String[] {"http://api.exemplo.com.br", "api.exemplo.com.br", "https://", "ftp://x.com", "https://a b.com",
                "http://localhost:8080", "http://127.0.0.1:8080"}) {
            assertThatThrownBy(() -> ligada(null).exigirCompleta(COMPLETAS, infinitePay(invalida)))
                    .as(invalida).isInstanceOf(IllegalStateException.class).hasMessageContaining("https");
        }
    }

    @Test
    void urlDaApiPrecisaSerHttpsMenosLocalhostEOcalhostIpDosTestes() {
        for (String invalida : new String[] {"http://public-api.kiwify.com", "public-api.kiwify.com", "ftp://x.com", "http://exemplo.com",
                "http://localhost.exemplo.com", "http://127.0.0.2:80"}) {
            assertThatThrownBy(() -> ligada(invalida).exigirCompleta(COMPLETAS, infinitePay("https://api.exemplo.com.br")))
                    .as(invalida).isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("TREINOS_PAGAMENTOS_KIWIFY_URL_API").hasMessageNotContaining("exemplo.com");
        }
        for (String valida : new String[] {"https://public-api.kiwify.com", "http://localhost:9000", "http://127.0.0.1:9000"}) {
            assertThatCode(() -> ligada(valida).exigirCompleta(COMPLETAS, infinitePay("https://api.exemplo.com.br")))
                    .as(valida).doesNotThrowAnyException();
        }
    }

    @Test
    void naoImprimeAUrl() {
        assertThat(ligada("https://api.exemplo.com").toString()).doesNotContain("exemplo");
    }

    @Test
    void naSubidaAsCredenciaisDaKiwifyJaGravadasPrecisamDaChaveQueAsDecifra() {
        // Desligada nada é lido: a credencial parada no banco não derruba a API (a regra é a da InfinitePay).
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var cifra = new CifraDePagamento(new PagamentosProperties(true, CHAVES, "k1", false, false));

        new VerificacaoDasCredenciais(jdbc, cifra, infinitePay(""), new KiwifyProperties(false, null, null)).run(null);

        verifyNoInteractions(jdbc);
    }
}
