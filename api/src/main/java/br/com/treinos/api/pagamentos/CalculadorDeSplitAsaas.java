package br.com.treinos.api.pagamentos;

import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente.SplitAsaas;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Cálculo puro do split da plataforma no Overtraining Pay (Asaas), baseado em {@link DireitosLocais} e
 * {@link AsaasProperties}. Sem acesso a banco nem chamadas de rede.
 * <p>
 * Regra crítica do Asaas: a carteira da própria subconta emissora ({@code walletIdSubconta}) NUNCA entra no array
 * {@code split}; ela recebe automaticamente o restante.
 */
@Component
public class CalculadorDeSplitAsaas {

    public static final String MODO_ISENTO = "ISENTO";
    public static final String MODO_TAXA_PLATAFORMA = "TAXA_PLATAFORMA";
    public static final String MODO_TAXA_PERCENTUAL = "TAXA_PERCENTUAL";
    public static final String MODO_ABATER_MENSALIDADE = "ABATER_MENSALIDADE";

    public record ResultadoSplit(List<SplitAsaas> splits, long retencaoTotalCentavos, long valorAbatidoCentavos) {
        public static final ResultadoSplit SEM_SPLIT = new ResultadoSplit(List.of(), 0L, 0L);
    }

    private final AsaasProperties asaasProperties;

    public CalculadorDeSplitAsaas(AsaasProperties asaasProperties) {
        this.asaasProperties = asaasProperties;
    }

    public ResultadoSplit calcular(long valorCobrancaCentavos, String walletIdSubconta, DireitosLocais direitos) {
        return calcular(valorCobrancaCentavos, walletIdSubconta, direitos, asaasProperties);
    }

    public static ResultadoSplit calcular(long valorCobrancaCentavos, String walletIdSubconta, DireitosLocais direitos,
                                          AsaasProperties props) {
        if (direitos == null || props == null || valorCobrancaCentavos <= 0) {
            return ResultadoSplit.SEM_SPLIT;
        }
        String walletMatriz = limpar(props.walletMatriz());
        if (walletMatriz == null) {
            return ResultadoSplit.SEM_SPLIT;
        }
        String modo = direitos.splitModo() == null ? MODO_ISENTO : direitos.splitModo().strip().toUpperCase(Locale.ROOT);
        if (MODO_ISENTO.equals(modo)) {
            return ResultadoSplit.SEM_SPLIT;
        }
        int bps = direitos.splitPercentualBps();
        if (bps <= 0) {
            return ResultadoSplit.SEM_SPLIT;
        }

        long retencaoBruta = Math.round(valorCobrancaCentavos * (bps / 10_000.0));
        long retencaoCentavos;

        if (MODO_TAXA_PLATAFORMA.equals(modo) || MODO_TAXA_PERCENTUAL.equals(modo)) {
            retencaoCentavos = Math.min(retencaoBruta, valorCobrancaCentavos - 1L);
            if (retencaoCentavos <= 0) {
                return ResultadoSplit.SEM_SPLIT;
            }
        } else if (MODO_ABATER_MENSALIDADE.equals(modo)) {
            // shortcut: ABATER_MENSALIDADE não retém nem abate nada (age como ISENTO) até a retenção ser gravada na cobrança e o
            // abatimento ir à Central com repetição (B2 do plano); religar o cálculo por saldo só depois disso.
            return ResultadoSplit.SEM_SPLIT;
        } else {
            return ResultadoSplit.SEM_SPLIT;
        }

        String walletSubconta = limpar(walletIdSubconta);
        String walletSocio = limpar(props.walletSocio());
        int socioBps = props.percentualSocioBps() == null ? AsaasProperties.PERCENTUAL_SOCIO_PADRAO_BPS
                : Math.max(0, Math.min(10_000, props.percentualSocioBps()));

        boolean usarSocio = walletSocio != null
                && !walletSocio.equals(walletSubconta)
                && !walletSocio.equals(walletMatriz)
                && socioBps > 0;

        List<SplitAsaas> splits = new ArrayList<>(2);
        long retencaoEfetiva = 0L;

        if (usarSocio) {
            long socioCentavos = Math.round(retencaoCentavos * (socioBps / 10_000.0));
            long matrizCentavos = retencaoCentavos - socioCentavos;
            if (matrizCentavos > 0 && !walletMatriz.equals(walletSubconta)) {
                splits.add(new SplitAsaas(walletMatriz, matrizCentavos, null));
                retencaoEfetiva += matrizCentavos;
            }
            if (socioCentavos > 0) {
                splits.add(new SplitAsaas(walletSocio, socioCentavos, null));
                retencaoEfetiva += socioCentavos;
            }
        } else if (!walletMatriz.equals(walletSubconta)) {
            splits.add(new SplitAsaas(walletMatriz, retencaoCentavos, null));
            retencaoEfetiva = retencaoCentavos;
        }

        if (splits.isEmpty() || retencaoEfetiva <= 0) {
            return ResultadoSplit.SEM_SPLIT;
        }
        return new ResultadoSplit(List.copyOf(splits), retencaoEfetiva, 0L);
    }

    private static String limpar(String valor) {
        if (valor == null) {
            return null;
        }
        String limpo = valor.strip();
        return limpo.isEmpty() ? null : limpo;
    }
}
