package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.OpcaoDaPrevia;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A conta da cobrança de saída, sem banco nem relógio (a prévia e o encerrar usam esta mesma, o segundo sob as travas).
 * "Meses que faltam" = competências anteriores a {@code minimo_ate} (estrito) com vencimento de hoje em diante: as mensalidades
 * abertas que cabem são canceladas e somadas pelo valor de cada uma, e as ainda não geradas saem do
 * {@link CalendarioDeCobranca} (nunca por {@code plusMonths} encadeado) vezes o valor mensal. As vencidas ficam fora (ficam em
 * aberto) e o mês passado que nunca foi gerado não entra (é o tema do acúmulo). Pausada conta como se retomasse hoje.
 */
final class CalculoDaSaida {

    /** R$ 1 milhão em centavos: teto único das três opções com valor (o do CRM). */
    static final long VALOR_MAXIMO = 100_000_000L;

    /**
     * @param vencidas      mensalidades abertas com vencimento antes de hoje (ficam em aberto)
     * @param aCancelar     mensalidades abertas a vencer dentro do mínimo (a opção FALTAM as cancela e as soma)
     * @param aVencerQueFicam mensalidades abertas a vencer que continuam abertas: as de competência a partir do mínimo ou, sem
     *                      mínimo (não elegível), todas as a vencer; a opção FALTAM não as cancela
     * @param mesesNaoGerados quantas competências ainda não geradas entram, e {@code valorNaoGerados} a soma delas
     * @param mesVigenteCoberto existe mensalidade cujo período contém hoje e que ainda cobre período
     */
    record Calculo(List<CobrancaAluno> vencidas, List<CobrancaAluno> aCancelar, List<CobrancaAluno> aVencerQueFicam,
                   int mesesNaoGerados,
                   long valorNaoGerados, long valorFaltam, boolean mesVigenteCoberto, boolean elegivel) {

        int mesesQueFaltam() {
            return aCancelar.size() + mesesNaoGerados;
        }
    }

    private CalculoDaSaida() {
    }

    /**
     * @param cobrem             as mensalidades da contratação que cobrem período (abertas, pagas e contestadas), em qualquer ordem
     * @param maiorCompetencia   maior competência de TODAS as mensalidades, canceladas e estornadas incluídas; nula = nenhuma
     */
    static Calculo calcular(ContratacaoAluno c, LocalDate hoje, List<CobrancaAluno> cobrem, LocalDate maiorCompetencia) {
        List<CobrancaAluno> vencidas = new ArrayList<>();
        List<CobrancaAluno> aVencer = new ArrayList<>();
        boolean mesVigenteCoberto = false;
        LocalDate maiorCoberta = null;
        for (CobrancaAluno m : cobrem) {
            if (maiorCoberta == null || m.getCompetencia().isAfter(maiorCoberta)) {
                maiorCoberta = m.getCompetencia();
            }
            if (!hoje.isBefore(m.getCompetencia()) && hoje.isBefore(m.getCompetencia().plusMonths(1))) {
                mesVigenteCoberto = true;
            }
            if (m.getSituacao() == CobrancaAluno.Situacao.ABERTA) {
                (m.getVencimento().isBefore(hoje) ? vencidas : aVencer).add(m);
            }
        }
        boolean elegivel = c.getPeriodicidade() == PeriodoDoPlano.MENSAL && c.getMinimoAte() != null;
        if (!elegivel) {
            return new Calculo(vencidas, List.of(), aVencer, 0, 0, 0, mesVigenteCoberto, false);
        }
        LocalDate minimo = c.getMinimoAte();
        List<CobrancaAluno> dentro = aVencer.stream().filter(m -> m.getCompetencia().isBefore(minimo)).toList();
        List<CobrancaAluno> restantes = aVencer.stream().filter(m -> !m.getCompetencia().isBefore(minimo)).toList();
        long soma = 0;
        for (CobrancaAluno m : dentro) {
            soma = Math.addExact(soma, m.getValorCentavos());
        }
        int naoGerados = 0;
        long valorNaoGerados = 0;
        LocalDate ancora = c.getSituacao() == ContratacaoAluno.Situacao.PAUSADA
                ? CalendarioDeCobranca.ancoraDaRetomada(hoje, PeriodoDoPlano.MENSAL, maiorCoberta) : c.getAncora();
        LocalDate maior = maiorCompetencia;
        LocalDate coberta = maiorCoberta;
        LocalDate competencia = CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, maior, coberta);
        while (competencia.isBefore(minimo)) {
            LocalDate vencimento = CalendarioDeCobranca.vencimento(competencia, c.getDiaVencimento(), null);
            if (!vencimento.isBefore(hoje)) {
                naoGerados++;
                valorNaoGerados = Math.addExact(valorNaoGerados, c.getValorCentavos());
            }
            maior = competencia;
            coberta = competencia;
            competencia = CalendarioDeCobranca.proximaCompetencia(ancora, PeriodoDoPlano.MENSAL, maior, coberta);
        }
        return new Calculo(vencidas, dentro, restantes, naoGerados, valorNaoGerados, Math.addExact(soma, valorNaoGerados),
                mesVigenteCoberto, true);
    }

    /** As quatro opções com o valor calculado e, quando indisponíveis, o motivo (texto fixo, sem dado de pessoa). */
    static List<OpcaoDaPrevia> opcoes(ContratacaoAluno c, Calculo k) {
        List<OpcaoDaPrevia> opcoes = new ArrayList<>();
        opcoes.add(faltam(k));
        opcoes.add(vigente(c, k));
        opcoes.add(c.getPeriodicidade().recorrente()
                ? new OpcaoDaPrevia(OpcaoDeSaida.OUTRO, true, null, null)
                : new OpcaoDaPrevia(OpcaoDeSaida.OUTRO, false, null, "Parcela única não tem cobrança de saída."));
        opcoes.add(new OpcaoDaPrevia(OpcaoDeSaida.NAO_COBRAR, true, null, null));
        return opcoes;
    }

    private static OpcaoDaPrevia faltam(Calculo k) {
        if (!k.elegivel()) {
            return indisponivel(OpcaoDeSaida.FALTAM, "Só vale em plano mensal com tempo mínimo.");
        }
        if (k.mesesQueFaltam() == 0) {
            return indisponivel(OpcaoDeSaida.FALTAM, "Não faltam meses para o mínimo.");
        }
        if (k.valorFaltam() > VALOR_MAXIMO) {
            return indisponivel(OpcaoDeSaida.FALTAM, "O valor passa do limite de R$ 1.000.000,00.");
        }
        return new OpcaoDaPrevia(OpcaoDeSaida.FALTAM, true, k.valorFaltam(), null);
    }

    private static OpcaoDaPrevia vigente(ContratacaoAluno c, Calculo k) {
        if (!k.elegivel()) {
            return indisponivel(OpcaoDeSaida.VIGENTE, "Só vale em plano mensal com tempo mínimo.");
        }
        if (c.getSituacao() == ContratacaoAluno.Situacao.PAUSADA) {
            return indisponivel(OpcaoDeSaida.VIGENTE, "A contratação está pausada.");
        }
        if (k.mesVigenteCoberto()) {
            return indisponivel(OpcaoDeSaida.VIGENTE, "Já há mensalidade do mês vigente.");
        }
        if (c.getValorCentavos() > VALOR_MAXIMO) {
            return indisponivel(OpcaoDeSaida.VIGENTE, "O valor passa do limite de R$ 1.000.000,00.");
        }
        return new OpcaoDaPrevia(OpcaoDeSaida.VIGENTE, true, c.getValorCentavos(), null);
    }

    private static OpcaoDaPrevia indisponivel(OpcaoDeSaida opcao, String motivo) {
        return new OpcaoDaPrevia(opcao, false, null, motivo);
    }
}
