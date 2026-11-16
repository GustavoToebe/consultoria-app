package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.CalculoDaSaida.Calculo;
import br.com.treinos.api.pagamentos.PagamentosDtos.OpcaoDaPrevia;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A conta da cobrança de saída, sem banco nem relógio (regra: docs/planos/saida-e-tempo-minimo.md, decisões 3, 7 e 9): meses
 * que faltam, vencidas fora, pausa, fronteira do mínimo, dia 31, elegibilidade e as quatro opções. Valores em centavos fictícios.
 */
class CalculoDaSaidaTest {

    private static final UUID ALUNO = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String MOTIVO_NAO_ELEGIVEL = "Só vale em plano mensal com tempo mínimo.";

    private static LocalDate d(String iso) {
        return LocalDate.parse(iso);
    }

    private static ContratacaoAluno contratacao(PeriodoDoPlano periodo, long valor, String inicio, int diaVencimento,
                                                String minimoAte) {
        PlanoComercial plano = new PlanoComercial("Plano de teste", valor, periodo, null, null);
        ContratacaoAluno c = new ContratacaoAluno(ALUNO, plano, valor, null, d(inicio), diaVencimento);
        c.definirMinimo(minimoAte == null ? null : d(minimoAte));
        return c;
    }

    private static ContratacaoAluno mensal(long valor, String inicio, int diaVencimento, String minimoAte) {
        return contratacao(PeriodoDoPlano.MENSAL, valor, inicio, diaVencimento, minimoAte);
    }

    /** Mensalidade aberta; o vencimento é a própria competência (dia de vencimento = dia da competência). */
    private static CobrancaAluno aberta(ContratacaoAluno c, String competencia, long valor) {
        CobrancaAluno m = new CobrancaAluno(c, d(competencia), d(competencia));
        m.reajustar(valor, d(competencia));
        return m;
    }

    private static CobrancaAluno paga(ContratacaoAluno c, String competencia, long valor) {
        CobrancaAluno m = aberta(c, competencia, valor);
        m.pagar(CobrancaAluno.MANUAL, null, d(competencia), null, null, null);
        return m;
    }

    /** Como o serviço chama: a maior competência de todas as mensalidades (aqui, só as que cobrem) ou nula. */
    private static Calculo calcular(ContratacaoAluno c, String hoje, CobrancaAluno... cobrem) {
        LocalDate maior = List.of(cobrem).stream().map(CobrancaAluno::getCompetencia).max(Comparator.naturalOrder()).orElse(null);
        return CalculoDaSaida.calcular(c, d(hoje), List.of(cobrem), maior);
    }

    private static OpcaoDaPrevia opcao(List<OpcaoDaPrevia> opcoes, OpcaoDeSaida qual) {
        return opcoes.stream().filter(o -> o.opcao() == qual).findFirst().orElseThrow();
    }

    @Test
    void exemploDoPlanoDuasVencidasMaisSaidaDeTresMeses() {
        ContratacaoAluno c = mensal(10_000, "2027-01-10", 10, "2027-06-10");
        CobrancaAluno jan = aberta(c, "2027-01-10", 10_000);
        CobrancaAluno fev = aberta(c, "2027-02-10", 10_000);
        // Valores diferentes do atual da contratação: a conta soma o de cada aberta, não "N × valor atual".
        CobrancaAluno mar = aberta(c, "2027-03-10", 9_000);
        CobrancaAluno abr = aberta(c, "2027-04-10", 9_500);

        Calculo k = calcular(c, "2027-03-10", jan, fev, mar, abr);

        assertThat(k.elegivel()).isTrue();
        assertThat(k.vencidas()).containsExactly(jan, fev);
        assertThat(k.aCancelar()).containsExactly(mar, abr);
        // Maio ainda não foi gerada: entra pelo valor mensal da contratação.
        assertThat(k.mesesNaoGerados()).isEqualTo(1);
        assertThat(k.valorNaoGerados()).isEqualTo(10_000);
        assertThat(k.mesesQueFaltam()).isEqualTo(3);
        assertThat(k.valorFaltam()).isEqualTo(9_000 + 9_500 + 10_000);
        OpcaoDaPrevia faltam = opcao(CalculoDaSaida.opcoes(c, k), OpcaoDeSaida.FALTAM);
        assertThat(faltam.disponivel()).isTrue();
        assertThat(faltam.valorCentavos()).isEqualTo(28_500L);
    }

    @Test
    void pausadaContaComoSeRetomasseHojeEIndisponibilizaVigente() {
        ContratacaoAluno c = mensal(10_000, "2027-01-10", 10, "2027-06-10");
        c.pausar();
        // Jan e fev pagas: o período livre começa em 10/03, mas hoje (20/03) vem depois e vira a âncora da retomada.
        Calculo k = calcular(c, "2027-03-20", paga(c, "2027-01-10", 10_000), paga(c, "2027-02-10", 10_000));

        // Competências 20/03, 20/04 e 20/05 (vencem 10/04, 10/05 e 10/06). Pela âncora velha (10/01) seriam só duas: 10/03 já venceu.
        assertThat(k.mesesNaoGerados()).isEqualTo(3);
        assertThat(k.valorFaltam()).isEqualTo(30_000);
        assertThat(k.mesVigenteCoberto()).isFalse();
        OpcaoDaPrevia vigente = opcao(CalculoDaSaida.opcoes(c, k), OpcaoDeSaida.VIGENTE);
        assertThat(vigente.disponivel()).isFalse();
        assertThat(vigente.valorCentavos()).isNull();
        assertThat(vigente.motivo()).isEqualTo("A contratação está pausada.");
    }

    @Test
    void mesPassadoQueNuncaFoiGeradoNaoEntraNaConta() {
        ContratacaoAluno c = mensal(10_000, "2027-01-10", 10, "2027-05-10");

        Calculo k = calcular(c, "2027-03-10");

        // Jan e fev (vencimentos antes de hoje) são acúmulo, outro tema; entram só mar e abr.
        assertThat(k.vencidas()).isEmpty();
        assertThat(k.aCancelar()).isEmpty();
        assertThat(k.mesesNaoGerados()).isEqualTo(2);
        assertThat(k.valorFaltam()).isEqualTo(20_000);
    }

    @Test
    void competenciaIgualAoMinimoNaoEntraEAAnteriorEntraEntreAsAbertas() {
        ContratacaoAluno c = mensal(10_000, "2027-03-10", 10, "2027-06-10");
        CobrancaAluno mai = aberta(c, "2027-05-10", 10_000);
        CobrancaAluno jun = aberta(c, "2027-06-10", 10_000);

        Calculo k = calcular(c, "2027-03-10", paga(c, "2027-03-10", 10_000), paga(c, "2027-04-10", 10_000), mai, jun);

        assertThat(k.aCancelar()).containsExactly(mai);
        assertThat(k.mesesQueFaltam()).isEqualTo(1);
        assertThat(k.valorFaltam()).isEqualTo(10_000);
    }

    @Test
    void competenciaIgualAoMinimoNaoEntraEAAnteriorEntraEntreAsNaoGeradas() {
        ContratacaoAluno c = mensal(10_000, "2027-03-10", 10, "2027-05-10");
        CobrancaAluno marPaga = paga(c, "2027-03-10", 10_000);
        // Mínimo em 10/05: só abril entra (maio, igual ao mínimo, fica de fora).
        assertThat(calcular(c, "2027-03-10", marPaga).mesesNaoGerados()).isEqualTo(1);

        // Mínimo em 11/05: maio é anterior e entra.
        c.definirMinimo(d("2027-05-11"));
        assertThat(calcular(c, "2027-03-10", marPaga).mesesNaoGerados()).isEqualTo(2);
    }

    @Test
    void abertaAVencerDeCompetenciaDoMinimoEmDianteContinuaAberta() {
        ContratacaoAluno c = mensal(10_000, "2027-03-10", 10, "2027-06-10");
        CobrancaAluno abr = aberta(c, "2027-04-10", 10_000);
        CobrancaAluno mai = aberta(c, "2027-05-10", 10_000);

        Calculo k = calcular(c, "2027-03-10", paga(c, "2027-03-10", 10_000), abr, mai,
                aberta(c, "2027-06-10", 10_000), aberta(c, "2027-07-10", 10_000));

        // Jun (igual) e jul (depois) não são canceladas nem somadas.
        assertThat(k.aCancelar()).containsExactly(abr, mai);
        assertThat(k.valorFaltam()).isEqualTo(20_000);
        assertThat(k.vencidas()).isEmpty();
    }

    @Test
    void mesFuturoJaPagoDentroDoMinimoNaoEhSomadoNemViraNaoGerado() {
        ContratacaoAluno c = mensal(10_000, "2027-03-10", 10, "2027-06-10");
        CobrancaAluno mar = aberta(c, "2027-03-10", 10_000);

        // Abril pago adiantado e é a última gerada: maio é o único mês não gerado; abril não conta em lugar nenhum.
        Calculo k = calcular(c, "2027-03-10", mar, paga(c, "2027-04-10", 10_000));

        assertThat(k.aCancelar()).containsExactly(mar);
        assertThat(k.mesesNaoGerados()).isEqualTo(1);
        assertThat(k.mesesQueFaltam()).isEqualTo(2);
        assertThat(k.valorFaltam()).isEqualTo(20_000);
    }

    @Test
    void mesFuturoPagoNoMeioDasAbertasTambemFicaFora() {
        ContratacaoAluno c = mensal(10_000, "2027-03-10", 10, "2027-06-10");
        CobrancaAluno mar = aberta(c, "2027-03-10", 9_000);
        CobrancaAluno mai = aberta(c, "2027-05-10", 9_000);

        Calculo k = calcular(c, "2027-03-10", mar, paga(c, "2027-04-10", 9_500), mai);

        assertThat(k.aCancelar()).containsExactly(mar, mai);
        assertThat(k.mesesNaoGerados()).isZero();
        assertThat(k.valorFaltam()).isEqualTo(18_000);
    }

    @Test
    void ancoraNoDia31SegueOCalendarioSemDerivaDeDia() {
        ContratacaoAluno c = mensal(10_000, "2027-01-31", 31, "2027-06-30");

        // Hoje é o último dia de fevereiro. Competências: 28/02, 31/03, 30/04 e 31/05 (30/06 é o mínimo, fora).
        // Encadeando plusMonths a partir de 28/02 sairiam 28/03, 28/04, 28/05 e 28/06: cinco meses, um a mais.
        Calculo k = calcular(c, "2027-02-28", paga(c, "2027-01-31", 10_000));

        assertThat(k.mesesNaoGerados()).isEqualTo(4);
        assertThat(k.valorFaltam()).isEqualTo(40_000);
    }

    @Test
    void mesVigenteCobertoNoUltimoDiaDoMes() {
        ContratacaoAluno c = mensal(10_000, "2027-01-31", 31, "2027-06-30");
        CobrancaAluno jan = paga(c, "2027-01-31", 10_000);

        // O período de 31/01 vai até 27/02 (31/01 + 1 mês = 28/02, exclusivo): em 28/02 já é o de 28/02, ainda não gerado.
        assertThat(calcular(c, "2027-02-27", jan).mesVigenteCoberto()).isTrue();
        assertThat(calcular(c, "2027-02-28", jan).mesVigenteCoberto()).isFalse();
        // Gerada a de 28/02, ela cobre hoje (28/02) e VIGENTE sai.
        Calculo comFev = calcular(c, "2027-02-28", jan, aberta(c, "2027-02-28", 10_000));
        assertThat(comFev.mesVigenteCoberto()).isTrue();
        assertThat(opcao(CalculoDaSaida.opcoes(c, comFev), OpcaoDeSaida.VIGENTE).disponivel()).isFalse();

        // Mês de 30 dias: 31/03 + 1 mês = 30/04; em 29/04 ainda cobre, em 30/04 não.
        CobrancaAluno mar = paga(c, "2027-03-31", 10_000);
        assertThat(calcular(c, "2027-04-29", mar).mesVigenteCoberto()).isTrue();
        assertThat(calcular(c, "2027-04-30", mar).mesVigenteCoberto()).isFalse();
    }

    /**
     * DÚVIDA (relatada, comportamento atual): com âncora no dia 31, o período de 28/02 termina em 27/03 e o da competência
     * seguinte (31/03) só começa em 31/03; em 28, 29 e 30/03 nenhuma mensalidade cobre hoje, então {@code mesVigenteCoberto} fica
     * falso e VIGENTE aparece disponível mesmo com fevereiro pago. Vem do desenho do calendário, não de um erro da conta.
     */
    @Test
    void ancoraNoDia31DeixaTresDiasSemMesVigenteEmMarco() {
        ContratacaoAluno c = mensal(10_000, "2027-01-31", 31, "2027-06-30");

        Calculo k = calcular(c, "2027-03-30", paga(c, "2027-01-31", 10_000), paga(c, "2027-02-28", 10_000));

        assertThat(k.mesVigenteCoberto()).isFalse();
        assertThat(opcao(CalculoDaSaida.opcoes(c, k), OpcaoDeSaida.VIGENTE).disponivel()).isTrue();
    }

    @Test
    void periodicidadeNaoMensalNaoEhElegivel() {
        ContratacaoAluno c = contratacao(PeriodoDoPlano.TRIMESTRAL, 30_000, "2027-01-10", 10, "2027-12-10");
        CobrancaAluno vencida = aberta(c, "2027-01-10", 30_000);

        Calculo k = calcular(c, "2027-03-10", vencida, aberta(c, "2027-04-10", 30_000));

        assertThat(k.elegivel()).isFalse();
        assertThat(k.aCancelar()).isEmpty();
        assertThat(k.mesesQueFaltam()).isZero();
        assertThat(k.valorFaltam()).isZero();
        assertThat(k.vencidas()).containsExactly(vencida);
        indisponiveisPorNaoElegivel(CalculoDaSaida.opcoes(c, k));
    }

    @Test
    void semMinimoNaoEhElegivel() {
        ContratacaoAluno c = mensal(10_000, "2027-01-10", 10, null);

        Calculo k = calcular(c, "2027-03-10", aberta(c, "2027-03-10", 10_000));

        assertThat(k.elegivel()).isFalse();
        assertThat(k.aCancelar()).isEmpty();
        assertThat(k.valorFaltam()).isZero();
        indisponiveisPorNaoElegivel(CalculoDaSaida.opcoes(c, k));
    }

    private static void indisponiveisPorNaoElegivel(List<OpcaoDaPrevia> opcoes) {
        for (OpcaoDeSaida qual : List.of(OpcaoDeSaida.FALTAM, OpcaoDeSaida.VIGENTE)) {
            OpcaoDaPrevia o = opcao(opcoes, qual);
            assertThat(o.disponivel()).as(qual.name()).isFalse();
            assertThat(o.valorCentavos()).isNull();
            assertThat(o.motivo()).isEqualTo(MOTIVO_NAO_ELEGIVEL);
        }
        assertThat(opcao(opcoes, OpcaoDeSaida.NAO_COBRAR).disponivel()).isTrue();
    }

    @Test
    void parcelaUnicaNaoTemOpcaoOutroEOsDemaisNaoSaoElegiveis() {
        ContratacaoAluno c = contratacao(PeriodoDoPlano.PARCELA_UNICA, 50_000, "2027-01-10", 10, "2027-12-10");

        Calculo k = calcular(c, "2027-03-10");
        List<OpcaoDaPrevia> opcoes = CalculoDaSaida.opcoes(c, k);

        assertThat(k.elegivel()).isFalse();
        OpcaoDaPrevia outro = opcao(opcoes, OpcaoDeSaida.OUTRO);
        assertThat(outro.disponivel()).isFalse();
        assertThat(outro.motivo()).isEqualTo("Parcela única não tem cobrança de saída.");
        assertThat(opcao(opcoes, OpcaoDeSaida.NAO_COBRAR).disponivel()).isTrue();
        assertThat(opcao(opcoes, OpcaoDeSaida.FALTAM).disponivel()).isFalse();
        assertThat(opcao(opcoes, OpcaoDeSaida.VIGENTE).disponivel()).isFalse();
    }

    @Test
    void recorrenteSempreTemOutroENaoCobrarSempreDisponiveis() {
        ContratacaoAluno c = mensal(10_000, "2027-01-10", 10, "2027-06-10");

        List<OpcaoDaPrevia> opcoes = CalculoDaSaida.opcoes(c, calcular(c, "2027-03-10"));

        assertThat(opcoes).extracting(OpcaoDaPrevia::opcao)
                .containsExactly(OpcaoDeSaida.FALTAM, OpcaoDeSaida.VIGENTE, OpcaoDeSaida.OUTRO, OpcaoDeSaida.NAO_COBRAR);
        OpcaoDaPrevia outro = opcao(opcoes, OpcaoDeSaida.OUTRO);
        assertThat(outro.disponivel()).isTrue();
        assertThat(outro.valorCentavos()).isNull();
        assertThat(opcao(opcoes, OpcaoDeSaida.NAO_COBRAR).disponivel()).isTrue();
    }

    @Test
    void faltamIndisponivelQuandoNaoFaltaMesEVigenteDisponivel() {
        // Mínimo em 10/03 e hoje 10/03: nenhuma competência anterior vence de hoje em diante.
        ContratacaoAluno c = mensal(10_000, "2027-01-10", 10, "2027-03-10");

        Calculo k = calcular(c, "2027-03-10", paga(c, "2027-01-10", 10_000), paga(c, "2027-02-10", 10_000));
        List<OpcaoDaPrevia> opcoes = CalculoDaSaida.opcoes(c, k);

        assertThat(k.mesesQueFaltam()).isZero();
        OpcaoDaPrevia faltam = opcao(opcoes, OpcaoDeSaida.FALTAM);
        assertThat(faltam.disponivel()).isFalse();
        assertThat(faltam.valorCentavos()).isNull();
        assertThat(faltam.motivo()).isEqualTo("Não faltam meses para o mínimo.");
        OpcaoDaPrevia vigente = opcao(opcoes, OpcaoDeSaida.VIGENTE);
        assertThat(vigente.disponivel()).isTrue();
        assertThat(vigente.valorCentavos()).isEqualTo(10_000L);
    }

    @Test
    void vigenteIndisponivelQuandoHaMensalidadeDoMesVigente() {
        ContratacaoAluno c = mensal(10_000, "2027-03-10", 10, "2027-06-10");

        Calculo k = calcular(c, "2027-03-25", aberta(c, "2027-03-10", 10_000));

        assertThat(k.mesVigenteCoberto()).isTrue();
        OpcaoDaPrevia vigente = opcao(CalculoDaSaida.opcoes(c, k), OpcaoDeSaida.VIGENTE);
        assertThat(vigente.disponivel()).isFalse();
        assertThat(vigente.motivo()).isEqualTo("Já há mensalidade do mês vigente.");
    }

    @Test
    void tetoDeUmMilhaoTornaFaltamIndisponivelSoQuandoPassa() {
        // Dois meses não gerados (março e abril; o mínimo é 10/05).
        ContratacaoAluno noTeto = mensal(50_000_000, "2027-03-10", 10, "2027-05-10");
        Calculo kTeto = calcular(noTeto, "2027-03-10");
        assertThat(kTeto.valorFaltam()).isEqualTo(CalculoDaSaida.VALOR_MAXIMO);
        assertThat(opcao(CalculoDaSaida.opcoes(noTeto, kTeto), OpcaoDeSaida.FALTAM).disponivel()).isTrue();

        ContratacaoAluno acima = mensal(50_000_001, "2027-03-10", 10, "2027-05-10");
        Calculo kAcima = calcular(acima, "2027-03-10");
        OpcaoDaPrevia faltam = opcao(CalculoDaSaida.opcoes(acima, kAcima), OpcaoDeSaida.FALTAM);
        assertThat(faltam.disponivel()).isFalse();
        assertThat(faltam.valorCentavos()).isNull();
        assertThat(faltam.motivo()).isEqualTo("O valor passa do limite de R$ 1.000.000,00.");
    }

    @Test
    void tetoDeUmMilhaoTornaVigenteIndisponivelSoQuandoOValorMensalPassa() {
        ContratacaoAluno noTeto = mensal(CalculoDaSaida.VALOR_MAXIMO, "2027-03-10", 10, "2027-06-10");
        OpcaoDaPrevia ok = opcao(CalculoDaSaida.opcoes(noTeto, calcular(noTeto, "2027-03-10")), OpcaoDeSaida.VIGENTE);
        assertThat(ok.disponivel()).isTrue();
        assertThat(ok.valorCentavos()).isEqualTo(CalculoDaSaida.VALOR_MAXIMO);

        ContratacaoAluno acima = mensal(CalculoDaSaida.VALOR_MAXIMO + 1, "2027-03-10", 10, "2027-06-10");
        OpcaoDaPrevia nao = opcao(CalculoDaSaida.opcoes(acima, calcular(acima, "2027-03-10")), OpcaoDeSaida.VIGENTE);
        assertThat(nao.disponivel()).isFalse();
        assertThat(nao.motivo()).isEqualTo("O valor passa do limite de R$ 1.000.000,00.");
    }
}
