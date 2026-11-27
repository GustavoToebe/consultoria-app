package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * A subida com o Overtraining Pay ligado exige as carteiras da matriz e do sócio (sem elas o split some em silêncio) e diz só
 * o NOME da variável que falta. Desligado, sobe sem nada. {@code PagamentosConfiguracao} chama {@code exigirCompleta} no
 * construtor, antes de qualquer rota.
 */
class AsaasPropertiesTest {

    private static final String CHAVES = "k1:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=";
    private static final PagamentosProperties PAGAMENTOS = new PagamentosProperties(true, CHAVES, "k1", false, false);
    private static final InfinitePayProperties INFINITEPAY = new InfinitePayProperties(false, null, null, null);
    private static final KiwifyProperties KIWIFY = new KiwifyProperties(false, null, null);

    private static AsaasProperties ligada(String walletMatriz, String walletSocio) {
        return new AsaasProperties(true, null, "chave-matriz-ficticia", "https://api.teste.local", walletMatriz,
                walletSocio, null, false);
    }

    private static void subir(AsaasProperties asaas) {
        new PagamentosConfiguracao(mock(PagamentosInterceptor.class), PAGAMENTOS, INFINITEPAY, KIWIFY, asaas);
    }

    @Test
    void carteiraDaMatrizAusenteDerrubaASubida() {
        assertThatThrownBy(() -> subir(ligada(null, "wal_socio"))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TREINOS_PAGAMENTOS_ASAAS_WALLET_MATRIZ").hasMessageNotContaining("wal_socio");
        assertThatThrownBy(() -> subir(ligada("  ", "wal_socio")))
                .hasMessageContaining("TREINOS_PAGAMENTOS_ASAAS_WALLET_MATRIZ");
    }

    @Test
    void carteiraDoSocioAusenteDerrubaASubida() {
        assertThatThrownBy(() -> subir(ligada("wal_matriz", "")))
                .hasMessageContaining("TREINOS_PAGAMENTOS_ASAAS_WALLET_SOCIO").hasMessageNotContaining("wal_matriz");
    }

    @Test
    void comAsCarteirasSobeNormal() {
        assertThatCode(() -> subir(ligada("wal_matriz", "wal_socio"))).doesNotThrowAnyException();
    }

    @Test
    void desligadoSobeSemCarteirasNemChaves() {
        assertThatCode(() -> new PagamentosConfiguracao(mock(PagamentosInterceptor.class),
                new PagamentosProperties(false, "", "", false, false), INFINITEPAY, KIWIFY,
                new AsaasProperties(false, null, null, null, null, null, null, false))).doesNotThrowAnyException();
    }
}
