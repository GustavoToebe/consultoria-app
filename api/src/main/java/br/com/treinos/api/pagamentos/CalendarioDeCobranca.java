package br.com.treinos.api.pagamentos;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * As datas de uma contratação, sem banco nem relógio. A competência de ordem {@code n} é sempre {@code âncora + n·k meses}
 * (nunca encadeando datas, para 31/01 não virar 28/02 e depois 28/03). O vencimento é a primeira data que não é anterior
 * à competência (nem ao piso, quando há) com o dia de vencimento limitado ao último dia do mês.
 */
final class CalendarioDeCobranca {

    private CalendarioDeCobranca() {
    }

    /**
     * A primeira competência da âncora, em passos da periodicidade, que vem depois de {@code maior} e não antes do fim do
     * período da última cobrança não cancelada ({@code maiorNaoCancelada + período}, que a grade antiga de uma âncora
     * anterior poderia deixar para trás, sobrepondo períodos).
     *
     * @param maior             maior competência de TODAS as linhas, canceladas incluídas; nula = nenhuma cobrança ainda
     * @param maiorNaoCancelada maior competência PAGA ou ABERTA (qualquer não cancelada); nula = nenhuma
     */
    static LocalDate proximaCompetencia(LocalDate ancora, PeriodoDoPlano periodo, LocalDate maior,
                                        LocalDate maiorNaoCancelada) {
        if (!periodo.recorrente()) {
            throw new IllegalArgumentException("Parcela única não tem próxima competência.");
        }
        long passo = periodo.meses();
        LocalDate piso = maiorNaoCancelada == null ? null : maiorNaoCancelada.plusMonths(passo);
        for (long n = 0;; n++) {
            LocalDate competencia = ancora.plusMonths(n * passo);
            if ((maior == null || competencia.isAfter(maior)) && (piso == null || !competencia.isBefore(piso))) {
                return competencia;
            }
        }
    }

    /**
     * A âncora de uma retomada: hoje, ou o dia seguinte ao fim do período da última cobrança não cancelada (paga ou
     * aberta), o que vier depois: retomar não sobrepõe período pago nem o de uma cobrança já aberta. O período de uma
     * competência {@code c} vai até {@code c + meses − 1 dia}, então o dia seguinte é {@code c + meses} (mesma conta de
     * meses das competências, que limita ao último dia do mês).
     *
     * @param maiorNaoCancelada maior competência com cobrança PAGA ou ABERTA da contratação; nula = nenhuma (vale hoje)
     */
    static LocalDate ancoraDaRetomada(LocalDate hoje, PeriodoDoPlano periodo, LocalDate maiorNaoCancelada) {
        if (maiorNaoCancelada == null || !periodo.recorrente()) {
            return hoje;
        }
        LocalDate livre = maiorNaoCancelada.plusMonths(periodo.meses());
        return livre.isAfter(hoje) ? livre : hoje;
    }

    /**
     * @param piso data abaixo da qual o vencimento não pode cair (hoje, ao refazer uma cobrança que ainda não venceu); nulo =
     *             só a competência vale como piso
     */
    static LocalDate vencimento(LocalDate competencia, int diaVencimento, LocalDate piso) {
        LocalDate minimo = piso != null && piso.isAfter(competencia) ? piso : competencia;
        YearMonth mes = YearMonth.from(competencia);
        while (true) {
            LocalDate candidato = mes.atDay(Math.min(diaVencimento, mes.lengthOfMonth()));
            if (!candidato.isBefore(minimo)) {
                return candidato;
            }
            mes = mes.plusMonths(1);
        }
    }
}
