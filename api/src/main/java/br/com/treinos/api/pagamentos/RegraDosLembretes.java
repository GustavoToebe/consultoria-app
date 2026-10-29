package br.com.treinos.api.pagamentos;

import java.time.LocalDate;
import java.util.Optional;

/**
 * Qual lembrete de cobrança é devido hoje (função pura, sem banco nem relógio: o "hoje" é o de Brasília, de quem chama).
 *
 * <ul>
 * <li>{@code ANTES}: de {@code vencimento − diasAntes} até {@value #FOLGA_EM_DIAS} dias depois, sempre antes do vencimento;</li>
 * <li>{@code NO_DIA}: só no dia do vencimento (no dia seguinte o texto "vence hoje" já estaria errado);</li>
 * <li>{@code DEPOIS}: de {@code vencimento + diasDepois} até {@value #FOLGA_EM_DIAS} dias depois.</li>
 * </ul>
 * A folga cobre o job que não rodou (API fora do ar, deploy) sem nunca mandar lembrete de uma cobrança antiga: quem liga a
 * configuração hoje não dispara e-mail para o que venceu há meses. 0 dias = aquele lembrete não sai. As janelas não se
 * cruzam, então no máximo um tipo é devido por dia; a chave única (cobrança, tipo) impede o segundo do mesmo tipo.
 */
public final class RegraDosLembretes {

    /** Dias além do alvo em que o lembrete ainda sai, se não saiu no dia certo. */
    public static final int FOLGA_EM_DIAS = 2;
    public static final int MAXIMO_ANTES = 15;
    public static final int MAXIMO_DEPOIS = 30;

    /** A configuração que a regra lê; {@code ligado} falso = nada é devido. */
    public record Configuracao(boolean ligado, int diasAntes, boolean noDia, int diasDepois) {

        public static final Configuracao PADRAO = new Configuracao(false, 3, true, 3);
    }

    private RegraDosLembretes() {
    }

    public static Optional<TipoDeLembrete> devido(LocalDate hoje, LocalDate vencimento, Configuracao c) {
        if (c == null || !c.ligado() || hoje == null || vencimento == null) {
            return Optional.empty();
        }
        if (c.diasAntes() > 0) {
            LocalDate alvo = vencimento.minusDays(c.diasAntes());
            if (dentro(hoje, alvo) && hoje.isBefore(vencimento)) {
                return Optional.of(TipoDeLembrete.ANTES);
            }
        }
        if (c.noDia() && hoje.equals(vencimento)) {
            return Optional.of(TipoDeLembrete.NO_DIA);
        }
        if (c.diasDepois() > 0 && dentro(hoje, vencimento.plusDays(c.diasDepois()))) {
            return Optional.of(TipoDeLembrete.DEPOIS);
        }
        return Optional.empty();
    }

    /**
     * O texto que vale para uma mensagem mandada hoje à mão (WhatsApp), sem olhar a configuração: antes, no dia ou depois.
     */
    public static TipoDeLembrete situacaoDeHoje(LocalDate hoje, LocalDate vencimento) {
        if (hoje.isBefore(vencimento)) {
            return TipoDeLembrete.ANTES;
        }
        return hoje.equals(vencimento) ? TipoDeLembrete.NO_DIA : TipoDeLembrete.DEPOIS;
    }

    /** Vencimentos que podem ter lembrete devido hoje (para a busca do planejamento não varrer cobranças antigas). */
    static LocalDate menorVencimento(LocalDate hoje) {
        return hoje.minusDays(MAXIMO_DEPOIS + FOLGA_EM_DIAS);
    }

    static LocalDate maiorVencimento(LocalDate hoje) {
        return hoje.plusDays(MAXIMO_ANTES);
    }

    private static boolean dentro(LocalDate hoje, LocalDate alvo) {
        return !hoje.isBefore(alvo) && !hoje.isAfter(alvo.plusDays(FOLGA_EM_DIAS));
    }
}
