package br.com.treinos.api.pagamentos;

import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.pagamentos.CalculadorDeSplitAsaas.ResultadoSplit;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente.SplitAsaas;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CalculadorDeSplitAsaasTest {

    private static final String WALLET_MATRIZ = "wal_matriz";
    private static final String WALLET_SOCIO = "wal_socio";
    private static final String WALLET_TREINADOR = "wal_treinador";

    private static AsaasProperties props(String walletMatriz, String walletSocio, Integer socioBps) {
        return new AsaasProperties(true, "https://api-sandbox.asaas.com/v3", "key", "https://api.teste.local",
                walletMatriz, walletSocio, socioBps, false);
    }

    private static DireitosLocais direitos(String modo, int bps, long saldoAbater) {
        return new DireitosLocais(UUID.randomUUID(), UUID.randomUUID(), 1L, "ATIVA", true, null, null,
                "PRO", "Pro", Map.of(), List.of(), Instant.now(), modo, bps, saldoAbater, 19900L, null);
    }

    @Test
    void isentoOuDireitosAusentesOuSemWalletMatrizRetornaSemSplit() {
        AsaasProperties p = props(WALLET_MATRIZ, WALLET_SOCIO, 3500);

        assertThat(CalculadorDeSplitAsaas.calcular(20000L, WALLET_TREINADOR, direitos("ISENTO", 500, 0L), p))
                .isEqualTo(ResultadoSplit.SEM_SPLIT);
        assertThat(CalculadorDeSplitAsaas.calcular(20000L, WALLET_TREINADOR, null, p))
                .isEqualTo(ResultadoSplit.SEM_SPLIT);
        assertThat(CalculadorDeSplitAsaas.calcular(20000L, WALLET_TREINADOR, direitos("TAXA_PLATAFORMA", 500, 0L),
                props("", WALLET_SOCIO, 3500))).isEqualTo(ResultadoSplit.SEM_SPLIT);
    }

    @Test
    void taxaPlataformaDivide65MatrizE35Socio() {
        AsaasProperties p = props(WALLET_MATRIZ, WALLET_SOCIO, 3500);
        // 5% de R$ 200,00 (20000 centavos) = R$ 10,00 (1000 centavos) -> 650 matriz + 350 sócio
        ResultadoSplit r = CalculadorDeSplitAsaas.calcular(20000L, WALLET_TREINADOR,
                direitos("TAXA_PLATAFORMA", 500, 0L), p);

        assertThat(r.retencaoTotalCentavos()).isEqualTo(1000L);
        assertThat(r.valorAbatidoCentavos()).isZero();
        assertThat(r.splits()).containsExactly(
                new SplitAsaas(WALLET_MATRIZ, 650L, null),
                new SplitAsaas(WALLET_SOCIO, 350L, null));
    }

    @Test
    void taxaPercentualSemWalletSocioVai100PorCentoParaMatriz() {
        AsaasProperties p = props(WALLET_MATRIZ, "", 3500);
        ResultadoSplit r = CalculadorDeSplitAsaas.calcular(10000L, WALLET_TREINADOR,
                direitos("TAXA_PERCENTUAL", 400, 0L), p);

        assertThat(r.retencaoTotalCentavos()).isEqualTo(400L);
        assertThat(r.valorAbatidoCentavos()).isZero();
        assertThat(r.splits()).containsExactly(new SplitAsaas(WALLET_MATRIZ, 400L, null));
    }

    /** B2: sem a retenção gravada na cobrança e o aviso repetido à Central, ABATER_MENSALIDADE não retém nem abate nada. */
    @Test
    void abaterMensalidadeNaoRetemNemAbateNada() {
        AsaasProperties p = props(WALLET_MATRIZ, WALLET_SOCIO, 3500);

        assertThat(CalculadorDeSplitAsaas.calcular(20000L, WALLET_TREINADOR,
                direitos("ABATER_MENSALIDADE", 1000, 700L), p)).isEqualTo(ResultadoSplit.SEM_SPLIT);
        assertThat(CalculadorDeSplitAsaas.calcular(500L, WALLET_TREINADOR,
                direitos("ABATER_MENSALIDADE", 10000, 5000L), p)).isEqualTo(ResultadoSplit.SEM_SPLIT);
        assertThat(CalculadorDeSplitAsaas.calcular(20000L, WALLET_TREINADOR,
                direitos("ABATER_MENSALIDADE", 1000, 0L), p)).isEqualTo(ResultadoSplit.SEM_SPLIT);
    }

    @Test
    void nuncaIncluiWalletDaPropriaSubcontaEmissoraNoSplit() {
        AsaasProperties p = props(WALLET_MATRIZ, WALLET_SOCIO, 3500);

        // Subconta emissora é a própria walletMatriz -> só inclui walletSocio
        ResultadoSplit emissoraMatriz = CalculadorDeSplitAsaas.calcular(20000L, WALLET_MATRIZ,
                direitos("TAXA_PLATAFORMA", 500, 0L), p);
        assertThat(emissoraMatriz.splits()).containsExactly(new SplitAsaas(WALLET_SOCIO, 350L, null));
        assertThat(emissoraMatriz.splits()).noneMatch(s -> WALLET_MATRIZ.equals(s.walletId()));

        // Subconta emissora é a própria walletSocio -> 100% da retenção na walletMatriz
        ResultadoSplit emissoraSocio = CalculadorDeSplitAsaas.calcular(20000L, WALLET_SOCIO,
                direitos("TAXA_PLATAFORMA", 500, 0L), p);
        assertThat(emissoraSocio.splits()).containsExactly(new SplitAsaas(WALLET_MATRIZ, 1000L, null));
        assertThat(emissoraSocio.splits()).noneMatch(s -> WALLET_SOCIO.equals(s.walletId()));

        // Sem sócio e emissora == matriz -> lista vazia
        ResultadoSplit soMatriz = CalculadorDeSplitAsaas.calcular(20000L, WALLET_MATRIZ,
                direitos("TAXA_PLATAFORMA", 500, 0L), props(WALLET_MATRIZ, "", 3500));
        assertThat(soMatriz).isEqualTo(ResultadoSplit.SEM_SPLIT);
    }
}
