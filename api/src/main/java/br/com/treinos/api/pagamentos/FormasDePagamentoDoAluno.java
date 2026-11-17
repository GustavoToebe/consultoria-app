package br.com.treinos.api.pagamentos;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Regra pura (sem banco, sem relógio) de como o aluno pode pagar uma cobrança: dadas as formas que o treinador ligou, decide a
 * lista {@code formasDePagamento} e monta o código Pix copia e cola. O Manual não depende de nada e sempre entra. Quem chama
 * (a fase do aluno) traz os fatos: credencial da InfinitePay, link do plano e situação da cobrança.
 */
public final class FormasDePagamentoDoAluno {

    /** Na ordem em que o aluno vê. */
    public enum Forma { INFINITEPAY, LINK_PROPRIO, PIX, MANUAL }

    /** Os dados do Pix que o treinador configurou (a chave é dado pessoal: o {@code toString} a esconde). */
    public record PixConfigurado(ChavePix.Tipo tipo, String chave, String nomeRecebedor, String cidade) {
        @Override
        public String toString() {
            return "PixConfigurado[tipo=" + tipo + "]";
        }
    }

    /**
     * O que o treinador ligou. {@code pix} é nulo quando o Pix está desligado ou sem configuração completa. Sem linha gravada vale
     * {@link #PADRAO}: o comportamento de antes das formas (InfinitePay e Manual).
     */
    public record Ligadas(boolean infinitePay, boolean linkProprio, PixConfigurado pix) {
        public static final Ligadas PADRAO = new Ligadas(true, false, null);
    }

    private FormasDePagamentoDoAluno() { }

    /**
     * @param infinitePayPronta a regra de hoje do {@code pagamentoOnline}: módulo da InfinitePay ligado e credencial do treinador
     * @param planoTemLink      o plano comercial da cobrança tem {@code linkDePagamento}
     * @param cobrancaAberta    a cobrança está ABERTA (o Pix só vale para ela)
     */
    public static List<Forma> decidir(Ligadas ligadas, boolean infinitePayPronta, boolean planoTemLink, boolean cobrancaAberta) {
        List<Forma> formas = new ArrayList<>(4);
        if (ligadas.infinitePay() && infinitePayPronta) {
            formas.add(Forma.INFINITEPAY);
        }
        if (ligadas.linkProprio() && planoTemLink) {
            formas.add(Forma.LINK_PROPRIO);
        }
        if (ligadas.pix() != null && cobrancaAberta) {
            formas.add(Forma.PIX);
        }
        formas.add(Forma.MANUAL);
        return formas;
    }

    /**
     * O código Pix da cobrança: valor do servidor ({@code valorCentavos} da cobrança, nunca do corpo) e o identificador curto
     * tirado do id dela (25 caracteres hexadecimais, sem informação pessoal). Vazio se o Pix não está ligado e configurado ou a
     * cobrança não está aberta.
     */
    public static Optional<String> codigoPix(Ligadas ligadas, UUID cobrancaId, long valorCentavos, boolean cobrancaAberta) {
        PixConfigurado pix = ligadas.pix();
        if (pix == null || !cobrancaAberta) {
            return Optional.empty();
        }
        String txid = cobrancaId.toString().replace("-", "").substring(0, 25);
        return Optional.of(BrCodePix.montar(pix.chave(), valorCentavos, pix.nomeRecebedor(), pix.cidade(), txid));
    }
}
