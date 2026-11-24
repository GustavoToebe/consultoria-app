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
 * ≥ 1. Parcela única não tem período: o único ciclo dela é base + 1 mês e ele não se renova, então o término pode ficar
 * para trás (dias negativos).
 *
 * <p>{@code alerta}: plano mensal não tem (nulo); os demais seguem {@code PROXIMO_VENCIMENTO} (até {@value #LIMIAR_EM_DIAS}
 * dias) e {@code EM_DIA}. Parcela única só alerta enquanto o fim do ciclo está dentro da janela (0 a 40 dias): passado o
 * término ela não alerta (nulo) nem entra nas renovações, nunca só por durar mais de um mês. Em vez disso, até
 * {@value #ENCERRADO_RECENTE_EM_DIAS} dias depois do término ela conta em "Encerraram sem renovar" ({@link #encerrouSemRenovar}),
 * grupo à parte; a ficha da contratação segue mostrando "Encerrado em" com a data.
 */
record VigenciaDoPlano(LocalDate termino, Long diasRestantes, String alerta) {

    static final int LIMIAR_EM_DIAS = 40;
    /** Quanto tempo a parcela única que passou do término aparece em "Encerraram sem renovar" (depois disso sai da lista). */
    static final int ENCERRADO_RECENTE_EM_DIAS = 30;

    static VigenciaDoPlano de(ContratacaoAluno c, LocalDate hoje) {
        if (c.fechado()) {
            return doContrato(c, hoje);
        }
        boolean retomada = c.getAncora() != null && c.getAncora().isAfter(c.getInicio());
        LocalDate base = retomada ? c.getAncora() : c.getInicio();
        // Contratação que ainda não começou: o ciclo é o primeiro, contado do início.
        LocalDate referencia = retomada || !hoje.isBefore(base) ? hoje : base;
        return de(base, c.getPeriodicidade(), referencia, hoje);
    }

    /**
     * Contrato fechado (V098): um ciclo só, do início até início + período do plano (parcela única: + 1 mês, como a regra dela), que
     * não se renova nem se move com pausa ou retomada. Quitar não encerra a contratação (D6), então ela segue ATIVA depois do término
     * e, como a parcela única, entra em "Encerraram sem renovar" por 30 dias.
     */
    private static VigenciaDoPlano doContrato(ContratacaoAluno c, LocalDate hoje) {
        LocalDate termino = c.getInicio().plusMonths(Math.max(1, c.getPeriodicidade().meses()));
        long dias = ChronoUnit.DAYS.between(hoje, termino);
        return new VigenciaDoPlano(termino, dias, c.getPeriodicidade() == PeriodoDoPlano.MENSAL || dias < 0 ? null : alerta(dias));
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
        // Só a parcela única chega aqui com dias negativos (o ciclo dela não se renova): sem alerta, como o mensal.
        return new VigenciaDoPlano(termino, dias, periodicidade == PeriodoDoPlano.MENSAL || dias < 0 ? null : alerta(dias));
    }

    /** Conta em "renovações próximas": tem alerta (não é mensal nem parcela única já terminada) e faltam até 40 dias. */
    boolean renovacaoProxima() {
        return alerta != null && diasRestantes != null && diasRestantes <= LIMIAR_EM_DIAS;
    }

    /**
     * Parcela única ativa que passou do término há até {@value #ENCERRADO_RECENTE_EM_DIAS} dias: "encerrou sem renovar" (o
     * grupo próprio da Visão geral; nunca em {@link #renovacaoProxima}). Só ela chega a {@code diasRestantes} negativo; o
     * chamador só passa contratação ATIVA (pausada e encerrada à mão ficam de fora).
     */
    boolean encerrouSemRenovar() {
        return diasRestantes != null && diasRestantes < 0 && diasRestantes >= -ENCERRADO_RECENTE_EM_DIAS;
    }

    private static String alerta(long dias) {
        return dias <= LIMIAR_EM_DIAS ? "PROXIMO_VENCIMENTO" : "EM_DIA";
    }
}
