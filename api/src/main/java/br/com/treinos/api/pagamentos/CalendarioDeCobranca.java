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

    /** A primeira competência da âncora, em passos da periodicidade, que vem depois de {@code maior} (nula = a primeira). */
    static LocalDate proximaCompetencia(LocalDate ancora, PeriodoDoPlano periodo, LocalDate maior) {
        if (!periodo.recorrente()) {
            throw new IllegalArgumentException("Parcela única não tem próxima competência.");
        }
        long passo = periodo.meses();
        for (long n = 0;; n++) {
            LocalDate competencia = ancora.plusMonths(n * passo);
            if (maior == null || competencia.isAfter(maior)) {
                return competencia;
            }
        }
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
