package br.com.treinos.api.pagamentos;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * As datas de uma contratação, sem banco nem relógio. A competência de ordem {@code n} é sempre {@code âncora + n·k meses}
 * (nunca encadeando datas, para 31/01 não virar 28/02 e depois 28/03). O vencimento é a primeira data que não é anterior
 * à competência (nem ao piso, quando há) com o dia de vencimento limitado ao último dia do mês. O período de uma competência
 * vai até o dia anterior à seguinte da mesma grade ({@link #fimDoPeriodo}): com âncora no dia 31, 28/02 cobre até 30/03 e
 * 31/03 começa em seguida, sem buraco em mês curto.
 */
final class CalendarioDeCobranca {

    private CalendarioDeCobranca() {
    }

    /**
     * A primeira competência da âncora, em passos da periodicidade, que vem depois de {@code maior} e não antes do fim do
     * período da última cobrança que cobre período ({@link #fimDoPeriodo}, que a grade antiga de uma âncora
     * anterior poderia deixar para trás, sobrepondo períodos).
     *
     * @param ancora       de onde a grade das competências é contada (a âncora da contratação)
     * @param maior        maior competência de TODAS as linhas, canceladas e estornadas incluídas; nula = nenhuma cobrança ainda
     * @param maiorCoberta maior competência de cobrança que cobre período (fora {@link CobrancaAluno#NAO_COBREM_PERIODO}:
     *                     paga, aberta ou contestada); nula = nenhuma
     */
    static LocalDate proximaCompetencia(LocalDate ancora, PeriodoDoPlano periodo, LocalDate maior,
                                        LocalDate maiorCoberta) {
        if (!periodo.recorrente()) {
            throw new IllegalArgumentException("Parcela única não tem próxima competência.");
        }
        long passo = periodo.meses();
        LocalDate piso = maiorCoberta == null ? null : fimDoPeriodo(ancora, passo, maiorCoberta);
        for (long n = 0;; n++) {
            LocalDate competencia = ancora.plusMonths(n * passo);
            if ((maior == null || competencia.isAfter(maior)) && (piso == null || !competencia.isBefore(piso))) {
                return competencia;
            }
        }
    }

    /**
     * A competência da primeira cobrança (D10). Com os meses anteriores, é o próprio início. Sem eles, é a última da grade
     * da âncora (o início) que não passa do mês de {@code hoje}: o período que cobre o mês corrente, e o que ficou para trás
     * não é cobrado. Início no mês corrente ou depois, e parcela única, ficam no início.
     */
    static LocalDate primeiraCompetencia(LocalDate inicio, PeriodoDoPlano periodo, LocalDate hoje, boolean mesesAnteriores) {
        YearMonth atual = YearMonth.from(hoje);
        if (mesesAnteriores || !periodo.recorrente() || !YearMonth.from(inicio).isBefore(atual)) {
            return inicio;
        }
        long passo = periodo.meses();
        long meses = ChronoUnit.MONTHS.between(YearMonth.from(inicio), atual);
        return inicio.plusMonths(meses / passo * passo);
    }

    /**
     * As competências que contratar cria agora, em ordem: a primeira e, em plano recorrente, cada seguinte até a primeira com
     * vencimento a partir de {@code hoje} (a mesma regra de {@code GeradorDeCobrancas.garantirAteHoje}, sem banco).
     */
    static List<LocalDate> competenciasAoContratar(LocalDate inicio, PeriodoDoPlano periodo, int diaVencimento,
                                                   LocalDate hoje, boolean mesesAnteriores) {
        List<LocalDate> competencias = new ArrayList<>();
        LocalDate ultima = primeiraCompetencia(inicio, periodo, hoje, mesesAnteriores);
        competencias.add(ultima);
        while (periodo.recorrente() && vencimento(ultima, diaVencimento, null).isBefore(hoje)) {
            ultima = proximaCompetencia(inicio, periodo, ultima, ultima);
            competencias.add(ultima);
        }
        return competencias;
    }

    /**
     * A âncora de uma retomada: hoje, ou o dia seguinte ao fim do período da última cobrança que cobre período (paga,
     * aberta ou contestada), o que vier depois: retomar não sobrepõe período pago nem o de uma cobrança já aberta. A
     * estornada, como a cancelada, não cobre: o dinheiro voltou. O dia seguinte ao fim do período é o de
     * {@link #fimDoPeriodo}.
     *
     * @param ancora       a âncora atual da contratação (a grade a que {@code maiorCoberta} pertence)
     * @param maiorCoberta maior competência de cobrança que cobre período da contratação; nula = nenhuma (vale hoje)
     */
    static LocalDate ancoraDaRetomada(LocalDate hoje, PeriodoDoPlano periodo, LocalDate ancora, LocalDate maiorCoberta) {
        if (maiorCoberta == null || !periodo.recorrente()) {
            return hoje;
        }
        LocalDate livre = fimDoPeriodo(ancora, periodo.meses(), maiorCoberta);
        return livre.isAfter(hoje) ? livre : hoje;
    }

    /**
     * O dia seguinte ao último dia coberto pela competência: a seguinte da grade da âncora quando ela é da grade (dia 31 em
     * mês curto não deixa dias descobertos) ou, se vier de uma grade antiga (antes de uma retomada), {@code competência + passo}.
     */
    static LocalDate fimDoPeriodo(LocalDate ancora, long passo, LocalDate competencia) {
        long meses = ChronoUnit.MONTHS.between(YearMonth.from(ancora), YearMonth.from(competencia));
        if (meses >= 0 && meses % passo == 0 && ancora.plusMonths(meses).equals(competencia)) {
            return ancora.plusMonths(meses + passo);
        }
        return competencia.plusMonths(passo);
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
