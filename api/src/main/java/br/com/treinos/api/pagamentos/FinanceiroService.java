package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.pagamentos.CobrancaAlunoRepository.PorForma;
import br.com.treinos.api.pagamentos.CobrancaAlunoRepository.PorPlano;
import br.com.treinos.api.pagamentos.CobrancaAlunoRepository.Soma;
import br.com.treinos.api.pagamentos.CobrancaAlunoRepository.SomaMensal;
import br.com.treinos.api.pagamentos.PagamentosDtos.Cartoes;
import br.com.treinos.api.pagamentos.PagamentosDtos.Inadimplencia;
import br.com.treinos.api.pagamentos.PagamentosDtos.Inadimplente;
import br.com.treinos.api.pagamentos.PagamentosDtos.Liquido;
import br.com.treinos.api.pagamentos.PagamentosDtos.MesDoPainel;
import br.com.treinos.api.pagamentos.PagamentosDtos.MesRecebido;
import br.com.treinos.api.pagamentos.PagamentosDtos.MovimentoDeAlunos;
import br.com.treinos.api.pagamentos.PagamentosDtos.Numeros;
import br.com.treinos.api.pagamentos.PagamentosDtos.PaginaInadimplentes;
import br.com.treinos.api.pagamentos.PagamentosDtos.Painel;
import br.com.treinos.api.pagamentos.PagamentosDtos.Periodo;
import br.com.treinos.api.pagamentos.PagamentosDtos.ProximosRecebimentos;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoMes;
import br.com.treinos.api.pagamentos.PagamentosDtos.ValorEQuantidade;
import br.com.treinos.api.web.Fuso;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Os números do financeiro: só agregados (JPQL, filtrados pela consultoria da sessão), datas em Brasília. {@code null}
 * é "sem dado" e nunca vira zero inventado: soma sem nenhuma linha sai nula, e contagem é sempre um número de verdade.
 * Cancelada não entra em nada; estornada e baixa desfeita saem do recebido porque deixam de ser PAGA. Atraso é o das
 * cobranças já geradas (não há agendador): a tela diz isso.
 */
@Service
public class FinanceiroService {

    public static final int TAMANHO_PAGINA = 50;
    public static final int MAXIMO_DE_MESES = 24;
    public static final String ROTULO_RESULTADO = "entradas − saídas registradas";
    private static final LocalDate PRIMEIRO_DIA = LocalDate.of(1900, 1, 1);
    private static final LocalDate ULTIMO_DIA = LocalDate.of(2999, 12, 31);

    private static final CobrancaAluno.Situacao ABERTA = CobrancaAluno.Situacao.ABERTA;
    private static final CobrancaAluno.Situacao PAGA = CobrancaAluno.Situacao.PAGA;
    private static final CobrancaAluno.Situacao CANCELADA = CobrancaAluno.Situacao.CANCELADA;

    private final CobrancaAlunoRepository cobrancas;
    private final ContratacaoAlunoRepository contratacoes;
    private final LancamentoFinanceiroRepository lancamentos;

    public FinanceiroService(CobrancaAlunoRepository cobrancas, ContratacaoAlunoRepository contratacoes,
                             LancamentoFinanceiroRepository lancamentos) {
        this.cobrancas = cobrancas;
        this.contratacoes = contratacoes;
        this.lancamentos = lancamentos;
    }

    // ---- GET /financeiro/numeros ----

    /** Os últimos 6 ou 12 meses (o corrente é parcial): recebido, previsto, inadimplência por contagem e receita recorrente. */
    @Transactional(readOnly = true)
    public Numeros numeros(int meses) {
        if (meses != 6 && meses != 12) {
            throw new BadRequestException("Meses precisa ser 6 ou 12.");
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        YearMonth atual = YearMonth.from(hoje);
        YearMonth primeiro = atual.minusMonths(meses - 1L);
        Map<YearMonth, Long> recebido = porMes(cobrancas.recebidoPorMes(PAGA, primeiro.atDay(1), hoje, null));
        List<MesRecebido> lista = new ArrayList<>();
        for (YearMonth mes = primeiro; !mes.isAfter(atual); mes = mes.plusMonths(1)) {
            lista.add(new MesRecebido(mes.toString(), mes.equals(atual), recebido.get(mes)));
        }
        Long previsto = cobrancas.abertasPorVencimento(ABERTA, hoje, ULTIMO_DIA, null).getTotal();
        return new Numeros(List.copyOf(lista), previsto, inadimplenciaPorContagem(primeiro.atDay(1), hoje.minusDays(1)),
                receitaRecorrente(null));
    }

    private BigDecimal inadimplenciaPorContagem(LocalDate de, LocalDate ate) {
        if (ate.isBefore(de)) {
            return null;
        }
        long cobradas = cobrancas.cobradoPorVencimento(CANCELADA, de, ate, null).getQuantidade();
        if (cobradas == 0) {
            return null;
        }
        long abertas = cobrancas.abertasPorVencimento(ABERTA, de, ate, null).getQuantidade();
        return percentual(abertas, cobradas);
    }

    // ---- GET /financeiro/painel ----

    /**
     * O período vira meses inteiros: de o dia 1 do mês de {@code de}, até o fim do mês de {@code ate} (padrão: os últimos 6
     * meses, com o corrente). No máximo 24 meses. Com {@code responsavelId} só os alunos dele ("Meus"); os lançamentos
     * avulsos não têm aluno, então ficam nulos nesse filtro.
     */
    @Transactional(readOnly = true)
    public Painel painel(LocalDate de, LocalDate ate, UUID responsavelId) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        YearMonth atual = YearMonth.from(hoje);
        YearMonth primeiro = de == null ? atual.minusMonths(5) : YearMonth.from(de);
        YearMonth ultimo = ate == null ? atual : YearMonth.from(ate);
        if (ultimo.isBefore(primeiro) || primeiro.until(ultimo, java.time.temporal.ChronoUnit.MONTHS) >= MAXIMO_DE_MESES) {
            throw new BadRequestException("Período inválido: de 1 a " + MAXIMO_DE_MESES + " meses.");
        }
        LocalDate inicio = primeiro.atDay(1);
        LocalDate fim = ultimo.atEndOfMonth();
        boolean meus = responsavelId != null;
        LocalDate ateHoje = fim.isBefore(hoje) ? fim : hoje;

        Soma recebido = inicio.isAfter(hoje) ? null : cobrancas.pagasPorPagamento(PAGA, inicio, ateHoje, responsavelId);
        Long recebidoTotal = recebido == null ? null : recebido.getTotal();
        LocalDate aVencerDe = inicio.isAfter(hoje) ? inicio : hoje;
        Long aReceber = aVencerDe.isAfter(fim) ? null
                : cobrancas.abertasPorVencimento(ABERTA, aVencerDe, fim, responsavelId).getTotal();
        LocalDate atrasoAte = fim.isBefore(hoje) ? fim : hoje.minusDays(1);
        boolean haAtraso = !atrasoAte.isBefore(inicio);
        Soma atrasadas = haAtraso ? cobrancas.abertasPorVencimento(ABERTA, inicio, atrasoAte, responsavelId) : null;
        Soma cobradas = haAtraso ? cobrancas.cobradoPorVencimento(CANCELADA, inicio, atrasoAte, responsavelId) : null;
        Long pagantes = recebido == null || recebido.getQuantidade() == 0 ? null
                : cobrancas.alunosQuePagaram(PAGA, inicio, ateHoje, responsavelId);
        Long medio = recebidoTotal == null || pagantes == null || pagantes == 0 ? null
                : BigDecimal.valueOf(recebidoTotal).divide(BigDecimal.valueOf(pagantes), 0, RoundingMode.HALF_UP).longValueExact();

        Cartoes cartoes = new Cartoes(recebidoTotal, aReceber,
                new ValorEQuantidade(atrasadas == null ? null : atrasadas.getTotal(),
                        atrasadas == null ? 0 : atrasadas.getQuantidade()),
                receitaRecorrente(responsavelId), pagantes, medio);

        Inadimplencia inadimplencia = inadimplenciaPorValor(atrasadas, cobradas);

        List<PagamentosDtos.PorForma> porForma = inicio.isAfter(hoje) ? List.of()
                : cobrancas.pagasPorForma(PAGA, inicio, ateHoje, responsavelId).stream().map(FinanceiroService::forma).toList();
        List<PagamentosDtos.PorPlano> porPlano = inicio.isAfter(hoje) ? List.of()
                : cobrancas.pagasPorPlano(PAGA, inicio, ateHoje, responsavelId).stream().map(FinanceiroService::plano).toList();

        return new Painel(new Periodo(inicio, fim), meus, cartoes,
                serie(primeiro, ultimo, atual, hoje, responsavelId), inadimplencia, porForma, porPlano,
                movimento(primeiro, ultimo, responsavelId), proximos(hoje, responsavelId),
                resultadoDoMes(atual, hoje, responsavelId), new Liquido(false,
                        "O líquido precisa das taxas do provedor, que ainda não estão informadas.", recebidoTotal));
    }

    private List<MesDoPainel> serie(YearMonth primeiro, YearMonth ultimo, YearMonth atual, LocalDate hoje,
                                    UUID responsavelId) {
        LocalDate inicio = primeiro.atDay(1);
        LocalDate fim = ultimo.atEndOfMonth();
        boolean meus = responsavelId != null;
        Map<YearMonth, Long> recebido = inicio.isAfter(hoje) ? Map.of()
                : porMes(cobrancas.recebidoPorMes(PAGA, inicio, hoje, responsavelId));
        LocalDate previstoDe = inicio.isAfter(hoje) ? inicio : hoje;
        Map<YearMonth, Long> previsto = previstoDe.isAfter(fim) ? Map.of()
                : porMes(cobrancas.previstoPorMes(ABERTA, previstoDe, fim, responsavelId));
        Map<YearMonth, Long> entradas = new HashMap<>();
        Map<YearMonth, Long> saidas = new HashMap<>();
        if (!meus) {
            for (var linha : lancamentos.somaPorMes(inicio, fim)) {
                var destino = linha.getTipo() == TipoDeLancamento.ENTRADA ? entradas : saidas;
                destino.put(YearMonth.of(linha.getAno(), linha.getMes()), linha.getTotal());
            }
        }
        List<MesDoPainel> serie = new ArrayList<>();
        for (YearMonth mes = primeiro; !mes.isAfter(ultimo); mes = mes.plusMonths(1)) {
            Long rec = recebido.get(mes);
            Long ent = entradas.get(mes);
            Long sai = saidas.get(mes);
            serie.add(new MesDoPainel(mes.toString(), mes.equals(atual), rec,
                    mes.atEndOfMonth().isBefore(hoje) ? null : previsto.get(mes), ent, sai,
                    meus ? null : resultado(rec, ent, sai)));
        }
        return List.copyOf(serie);
    }

    private static Inadimplencia inadimplenciaPorValor(Soma atrasadas, Soma cobradas) {
        Long cobrado = cobradas == null ? null : cobradas.getTotal();
        if (cobrado == null || cobrado == 0) {
            return new Inadimplencia(null, atrasadas == null ? null : atrasadas.getTotal(), cobrado);
        }
        long vencido = atrasadas == null || atrasadas.getTotal() == null ? 0 : atrasadas.getTotal();
        return new Inadimplencia(percentual(vencido, cobrado), vencido, cobrado);
    }

    private List<MovimentoDeAlunos> movimento(YearMonth primeiro, YearMonth ultimo, UUID responsavelId) {
        Instant de = primeiro.atDay(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        Instant ate = ultimo.plusMonths(1).atDay(1).atStartOfDay(Fuso.BRASILIA).toInstant();
        Map<YearMonth, Long> novas = contarPorMes(contratacoes.criadasNaJanela(de, ate, responsavelId));
        Map<YearMonth, Long> encerradas = contarPorMes(contratacoes.encerradasNaJanela(de, ate, responsavelId));
        List<MovimentoDeAlunos> lista = new ArrayList<>();
        for (YearMonth mes = primeiro; !mes.isAfter(ultimo); mes = mes.plusMonths(1)) {
            lista.add(new MovimentoDeAlunos(mes.toString(), novas.getOrDefault(mes, 0L), encerradas.getOrDefault(mes, 0L)));
        }
        return List.copyOf(lista);
    }

    private ProximosRecebimentos proximos(LocalDate hoje, UUID responsavelId) {
        return new ProximosRecebimentos("VENCIMENTO", janela(hoje, hoje.plusDays(7), responsavelId),
                janela(hoje, hoje.plusDays(30), responsavelId));
    }

    private ValorEQuantidade janela(LocalDate de, LocalDate ate, UUID responsavelId) {
        Soma s = cobrancas.abertasPorVencimento(ABERTA, de, ate, responsavelId);
        return new ValorEQuantidade(s.getTotal(), s.getQuantidade());
    }

    private ResultadoDoMes resultadoDoMes(YearMonth mes, LocalDate hoje, UUID responsavelId) {
        Long recebido = cobrancas.pagasPorPagamento(PAGA, mes.atDay(1), hoje, responsavelId).getTotal();
        if (responsavelId != null) {
            return new ResultadoDoMes(ROTULO_RESULTADO, mes.toString(), recebido, null, null, null);
        }
        Long entradas = null;
        Long saidas = null;
        for (var linha : lancamentos.somaPorMes(mes.atDay(1), mes.atEndOfMonth())) {
            if (linha.getTipo() == TipoDeLancamento.ENTRADA) {
                entradas = linha.getTotal();
            } else {
                saidas = linha.getTotal();
            }
        }
        return new ResultadoDoMes(ROTULO_RESULTADO, mes.toString(), recebido, entradas, saidas,
                resultado(recebido, entradas, saidas));
    }

    // ---- GET /financeiro/inadimplentes ----

    /** Cobranças abertas e vencidas, das mais antigas; {@code valorTotalCentavos} é a soma de todas, não só da página. */
    @Transactional(readOnly = true)
    public PaginaInadimplentes inadimplentes(UUID responsavelId, int pagina) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        var page = cobrancas.listarCrescente(false, ABERTA, true, hoje, PRIMEIRO_DIA, ULTIMO_DIA, null, responsavelId,
                PageRequest.of(Math.max(0, pagina), TAMANHO_PAGINA));
        List<Inadimplente> itens = page.getContent().stream().map(l -> new Inadimplente(l.cobranca().getId(),
                l.cobranca().getAlunoId(), l.alunoNome(), l.cobranca().getValorCentavos(), l.cobranca().getVencimento(),
                Respostas.diasDeAtraso(l.cobranca(), hoje))).toList();
        Long total = cobrancas.abertasPorVencimento(ABERTA, PRIMEIRO_DIA, hoje.minusDays(1), responsavelId).getTotal();
        return new PaginaInadimplentes(itens, page.getTotalElements(), total, Math.max(0, pagina));
    }

    // ---- Contas comuns ----

    /** Contratações ativas e recorrentes: valor ÷ meses da periodicidade, arredondado ao centavo em cada contratação. */
    private Long receitaRecorrente(UUID responsavelId) {
        var grupos = contratacoes.recorrentes(ContratacaoAluno.Situacao.ATIVA, PeriodoDoPlano.PARCELA_UNICA, responsavelId);
        if (grupos.isEmpty()) {
            return null;
        }
        long soma = 0;
        for (var g : grupos) {
            long mensal = BigDecimal.valueOf(g.getValor())
                    .divide(BigDecimal.valueOf(g.getPeriodicidade().meses()), 0, RoundingMode.HALF_UP).longValueExact();
            soma += mensal * g.getQuantidade();
        }
        return soma;
    }

    /** Resultado = recebido + entradas − saídas; sem nenhuma das três fontes, sem dado. */
    private static Long resultado(Long recebido, Long entradas, Long saidas) {
        if (recebido == null && entradas == null && saidas == null) {
            return null;
        }
        return nz(recebido) + nz(entradas) - nz(saidas);
    }

    private static long nz(Long valor) {
        return valor == null ? 0 : valor;
    }

    /** De 0 a 100 com uma casa. */
    private static BigDecimal percentual(long parte, long total) {
        return BigDecimal.valueOf(parte).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private static Map<YearMonth, Long> porMes(List<SomaMensal> linhas) {
        Map<YearMonth, Long> mapa = new HashMap<>();
        linhas.forEach(l -> mapa.put(YearMonth.of(l.getAno(), l.getMes()), l.getTotal()));
        return mapa;
    }

    private static Map<YearMonth, Long> contarPorMes(List<Instant> instantes) {
        Map<YearMonth, Long> mapa = new HashMap<>();
        for (Instant i : instantes) {
            mapa.merge(YearMonth.from(i.atZone(Fuso.BRASILIA)), 1L, Long::sum);
        }
        return mapa;
    }

    private static PagamentosDtos.PorForma forma(PorForma l) {
        return new PagamentosDtos.PorForma(l.getForma(), l.getQuantidade(), l.getTotal());
    }

    private static PagamentosDtos.PorPlano plano(PorPlano l) {
        return new PagamentosDtos.PorPlano(l.getPlanoId(), l.getNome(), l.getQuantidade(), l.getTotal());
    }
}
