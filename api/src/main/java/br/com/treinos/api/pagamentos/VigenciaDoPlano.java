package br.com.treinos.api.pagamentos;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * A vigência que a contratação e a Visão geral mostram, sem banco nem relógio ({@code hoje} é de Brasília, dado por quem
 * chama). Uma regra só: a resposta da contratação e as "renovações próximas" da Visão geral leem daqui.
 *
 * <p>Base = a âncora da contratação quando ela é posterior ao início (retomada depois de pausa: o período até ela já está
 * pago, então ela própria é o fim do ciclo se ainda não chegou), senão o início (contratação futura: o ciclo é o primeiro,
 * até início + período). Em plano recorrente o {@code termino} é o fim do ciclo em curso, <b>exclusivo</b> (o primeiro dia do
 * ciclo seguinte; ver {@link CalendarioDeCobranca#fimDoCicloAtual}): sempre depois de hoje, então {@code diasRestantes} é
 * ≥ 1 e nunca "vencido". Parcela única não tem ciclo: base + 1 mês, que pode ficar para trás (dias negativos,
 * {@code VENCIDO}).
 *
 * <p>{@code alerta}: plano mensal não tem (nulo); os demais seguem {@code VENCIDO} (&lt; 0 dia), {@code PROXIMO_VENCIMENTO}
 * (até {@value #LIMIAR_EM_DIAS} dias) e {@code EM_DIA}.
 */
record VigenciaDoPlano(LocalDate termino, Long diasRestantes, String alerta) {

    static final int LIMIAR_EM_DIAS = 40;

    static VigenciaDoPlano de(ContratacaoAluno c, LocalDate hoje) {
        boolean retomada = c.getAncora() != null && c.getAncora().isAfter(c.getInicio());
        LocalDate base = retomada ? c.getAncora() : c.getInicio();
        // Contratação que ainda não começou: o ciclo é o primeiro, contado do início.
        LocalDate referencia = retomada || !hoje.isBefore(base) ? hoje : base;
        return de(base, c.getPeriodicidade(), referencia, hoje);
    }

    /** @param referencia o dia em que se procura o ciclo em curso ({@code hoje}, ou o início de uma contratação futura). */
    static VigenciaDoPlano de(LocalDate base, PeriodoDoPlano periodicidade, LocalDate referencia, LocalDate hoje) {
        if (base == null) {
            return new VigenciaDoPlano(null, null, "EM_DIA");
        }
        LocalDate termino = periodicidade != null && periodicidade.recorrente()
                ? CalendarioDeCobranca.fimDoCicloAtual(base, periodicidade, referencia)
                : base.plusMonths(1);
        long dias = ChronoUnit.DAYS.between(hoje, termino);
        return new VigenciaDoPlano(termino, dias, periodicidade == PeriodoDoPlano.MENSAL ? null : alerta(dias));
    }

    /** Conta em "renovações próximas": tem alerta (não é mensal) e faltam até 40 dias (ou já passou, em parcela única). */
    boolean renovacaoProxima() {
        return alerta != null && diasRestantes != null && diasRestantes <= LIMIAR_EM_DIAS;
    }

    private static String alerta(long dias) {
        if (dias < 0) {
            return "VENCIDO";
        }
        return dias <= LIMIAR_EM_DIAS ? "PROXIMO_VENCIMENTO" : "EM_DIA";
    }
}
