package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.AlterarContratacaoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratarRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDeGeracao;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDeGeracaoRequest;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * Contratar, alterar, pausar e retomar (encerrar é do {@link EncerramentoDaContratacao}). Toda operação que muda a contratação trava aluno e contratação nessa
 * ordem ({@link Travas}); o valor de cada cobrança vem sempre da contratação, nunca do cliente. Pausar e retomar
 * são idempotentes (repetir devolve o estado atual, sem auditoria nova). Pausar mantém as cobranças abertas e para de gerar; a
 * geração mensal é da {@link RotinaDeGeracaoDeCobrancas}.
 */
@Service
public class ContratacaoService {

    private final AlunoRepository alunos;
    private final PlanoComercialRepository planos;
    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;
    private final Travas travas;
    private final GeradorDeCobrancas gerador;
    private final ContratoFechadoService fechados;
    private final Auditoria auditoria;

    ContratacaoService(AlunoRepository alunos, PlanoComercialRepository planos, ContratacaoAlunoRepository contratacoes,
                       CobrancaAlunoRepository cobrancas, Travas travas, GeradorDeCobrancas gerador,
                       ContratoFechadoService fechados, Auditoria auditoria) {
        this.alunos = alunos;
        this.planos = planos;
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.travas = travas;
        this.gerador = gerador;
        this.fechados = fechados;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<ContratacaoResponse> doAluno(UUID alunoId) {
        Travas.exigirAluno(alunos, alunoId);
        return contratacoes.findByAlunoIdOrderByCriadoEmDescIdDesc(alunoId).stream()
                .map(c -> resposta(c, nomeDoPlano(c))).toList();
    }

    @Transactional
    @Auditar(acao = "CONTRATACAO_CRIADA", entidade = "CONTRATACAO", resumo = "Contratou um plano comercial para um aluno.")
    public ContratacaoResponse contratar(UUID alunoId, ContratarRequest r, UUID usuarioId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(Travas::alunoNaoEncontrado);
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo não pode contratar um plano.", "ALUNO_INATIVO");
        }
        PlanoComercial plano = planos.findById(r.planoComercialId())
                .orElseThrow(() -> new NaoEncontradoException("Plano comercial não encontrado."));
        if (plano.isArquivado()) {
            throw new ConflictException("Plano arquivado não pode ser contratado.", "PLANO_COMERCIAL_ARQUIVADO");
        }
        if (contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA).isPresent()) {
            throw vigente();
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        exigirInicioValido(r.inicio(), hoje);
        ModoDeCobranca modo = r.modo();
        ContratoFechadoService.Conferido contrato = null;
        if (modo.fechado()) {
            contrato = fechados.conferir(r, plano, hoje);
        } else {
            fechados.exigirSemCamposDoContrato(r);
            if (r.diaVencimento() == null) {
                throw invalido("diaVencimento", "Informe o dia do vencimento.");
            }
        }
        // Contrato fechado: o valor da contratação é o total, sem o motivo de "valor diferente do plano" e sem mínimo.
        long valor = contrato != null ? contrato.totalCentavos()
                : r.valorCentavos() == null ? plano.getValorCentavos() : r.valorCentavos();
        String motivo = contrato != null ? null : motivoDoValor(valor, plano.getValorCentavos(), r.motivoValor());
        int dia = r.diaVencimento() != null ? r.diaVencimento() : r.inicio().getDayOfMonth();
        ContratacaoAluno contratacao = new ContratacaoAluno(alunoId, plano, valor, motivo, r.inicio(), dia);
        if (contrato != null) {
            contratacao.comoContrato(modo, contrato.totalCentavos());
        } else if (plano.getTempoMinimoMeses() != null && plano.getPeriodicidade() == PeriodoDoPlano.MENSAL) {
            contratacao.definirMinimo(r.inicio().plusMonths(plano.getTempoMinimoMeses()));
        }
        try {
            contratacoes.saveAndFlush(contratacao);
        } catch (DataIntegrityViolationException e) {
            if (violou(e, "ux_contratacao_vigente")) {
                throw vigente();
            }
            throw e;
        }
        if (contrato != null) {
            fechados.gerarCobrancas(contratacao, contrato, usuarioId, hoje);
            cobrancas.flush();
            return resposta(contratacao, plano.getNome());
        }
        CobrancaAluno primeira = gerador.primeira(contratacao, CalendarioDeCobranca.primeiraCompetencia(
                r.inicio(), plano.getPeriodicidade(), hoje, r.comMesesAnteriores()));
        if (Boolean.TRUE.equals(r.primeiroPeriodoPago())) {
            primeira.pagar(CobrancaAluno.MANUAL, FormaDePagamento.OUTRO, LocalDate.now(Fuso.BRASILIA), null,
                    "Período inicial já pago", null);
            cobrancas.save(primeira);
        }
        // Segue até o primeiro vencimento de hoje em diante (a rotina diária faria o mesmo no dia seguinte).
        gerador.garantirAteHoje(contratacao, hoje);
        cobrancas.flush();
        return resposta(contratacao, plano.getNome());
    }

    /**
     * D10: o que contratar com este corpo geraria em aberto agora, sem gravar nada (o app não calcula). Usa as mesmas datas da
     * geração ({@link CalendarioDeCobranca#competenciasAoContratar}); com {@code primeiroPeriodoPago} a primeira nasce paga e
     * não entra. Valor, mínimo e vigência não são conferidos aqui: quem recusa é o contratar.
     */
    @Transactional(readOnly = true)
    public PreviaDeGeracao previaDeGeracao(PreviaDeGeracaoRequest p) {
        Travas.exigirAluno(alunos, p.alunoId());
        PlanoComercial plano = planos.findById(p.planoComercialId())
                .orElseThrow(() -> new NaoEncontradoException("Plano comercial não encontrado."));
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        exigirInicioValido(p.inicio(), hoje);
        long valor = p.valorCentavos() == null ? plano.getValorCentavos() : p.valorCentavos();
        List<LocalDate> competencias = CalendarioDeCobranca.competenciasAoContratar(p.inicio(), plano.getPeriodicidade(),
                p.diaVencimento(), hoje, Boolean.TRUE.equals(p.gerarMesesAnteriores()));
        List<LocalDate> abertas = Boolean.TRUE.equals(p.primeiroPeriodoPago())
                ? competencias.subList(1, competencias.size()) : competencias;
        if (abertas.isEmpty()) {
            return new PreviaDeGeracao(0, 0, null, null);
        }
        return new PreviaDeGeracao(abertas.size(), Math.multiplyExact(valor, (long) abertas.size()),
                YearMonth.from(abertas.get(0)).toString(), YearMonth.from(abertas.get(abertas.size() - 1)).toString());
    }

    private static void exigirInicioValido(LocalDate inicio, LocalDate hoje) {
        if (inicio.isBefore(hoje.minusYears(10)) || inicio.isAfter(hoje.plusYears(1))) {
            throw invalido("inicio", "O início precisa estar entre os últimos 10 anos e o próximo ano.");
        }
    }

    /**
     * Valor e dia de vencimento novos. Refaz no lugar só as cobranças abertas que ainda não venceram (as vencidas e as
     * pagas não mudam; a cobrança de saída nunca é reajustada); o vencimento refeito nunca fica antes de hoje, então a
     * edição não gera cobrança vencida. {@code minimoAte} substitui o que havia (nulo apaga): o formulário reenvia o atual.
     */
    @Transactional
    @Auditar(acao = "CONTRATACAO_ALTERADA", entidade = "CONTRATACAO", resumo = "Alterou a contratação de um aluno.")
    public ContratacaoResponse alterar(UUID id, AlterarContratacaoRequest r) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        exigirNaoEncerrada(c);
        if (c.fechado()) {
            // O PUT mudaria o valor da contratação sem mudar o total do contrato (V098) e quebraria a conta dele.
            throw new ConflictException("Contrato fechado não se altera por aqui: encerre o contrato.",
                    "CONTRATO_FECHADO_NAO_ALTERA");
        }
        conferirVersao(c, r.versao());
        PlanoComercial plano = planos.findById(c.getPlanoComercialId())
                .orElseThrow(() -> new NaoEncontradoException("Plano comercial não encontrado."));
        String motivo = motivoDoValor(r.valorCentavos(), plano.getValorCentavos(), r.motivoValor());
        c.alterar(r.valorCentavos(), motivo, r.diaVencimento(), minimoValido(c, r.minimoAte()));
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        for (CobrancaAluno aberta : cobrancas.findByContratacaoIdAndTipoAndSituacaoAndVencimentoGreaterThanEqual(
                c.getId(), CobrancaAluno.Tipo.MENSALIDADE, CobrancaAluno.Situacao.ABERTA, hoje)) {
            aberta.reajustar(r.valorCentavos(),
                    CalendarioDeCobranca.vencimento(aberta.getCompetencia(), r.diaVencimento(), hoje));
        }
        return resposta(contratacoes.saveAndFlush(c), plano.getNome());
    }

    @Transactional
    public ContratacaoResponse pausar(UUID id, Long versao) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        exigirNaoEncerrada(c);
        exigirNaoFechada(c);
        if (c.getSituacao() == ContratacaoAluno.Situacao.PAUSADA) {
            return resposta(c, nomeDoPlano(c));
        }
        conferirVersao(c, versao);
        c.pausar();
        return mudou(c, "CONTRATACAO_PAUSADA", "Pausou a contratação de um aluno.");
    }

    /**
     * Recomeça a contar em max(hoje, dia seguinte ao fim do período da última cobrança que COBRE período: paga, aberta ou
     * contestada; cancelada e estornada não cobrem): o período parado não é cobrado e retomar nunca sobrepõe período pago
     * nem o de uma cobrança já aberta. Volta a gerar pela regra de sempre ({@link GeradorDeCobrancas#garantirAteHoje}); as
     * cobranças que já estavam abertas ao pausar continuam como estão (D2).
     */
    @Transactional
    public ContratacaoResponse retomar(UUID id, Long versao) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        exigirNaoEncerrada(c);
        exigirNaoFechada(c);
        if (c.getSituacao() == ContratacaoAluno.Situacao.ATIVA) {
            return resposta(c, nomeDoPlano(c));
        }
        conferirVersao(c, versao);
        LocalDate maiorCoberta = cobrancas.maiorCompetenciaCoberta(c.getId(), CobrancaAluno.NAO_COBREM_PERIODO)
                .orElse(null);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        c.retomar(CalendarioDeCobranca.ancoraDaRetomada(hoje, c.getPeriodicidade(), c.getAncora(), maiorCoberta));
        contratacoes.flush();
        gerador.garantirAteHoje(c, hoje);
        return mudou(c, "CONTRATACAO_RETOMADA", "Retomou a contratação de um aluno.");
    }

    private ContratacaoResponse mudou(ContratacaoAluno c, String acao, String resumo) {
        ContratacaoResponse resposta = resposta(contratacoes.saveAndFlush(c), nomeDoPlano(c));
        cobrancas.flush();
        auditoria.registrarEvento(acao, "CONTRATACAO", c.getId(), resumo);
        return resposta;
    }

    /** Nulo apaga; senão entre o início e o início + 60 meses, e só em contratação mensal. 422 sem repetir a data. */
    private static LocalDate minimoValido(ContratacaoAluno c, LocalDate minimoAte) {
        if (minimoAte == null) {
            return null;
        }
        if (c.getPeriodicidade() != PeriodoDoPlano.MENSAL) {
            throw invalido("minimoAte", "O tempo mínimo só vale em plano mensal.");
        }
        if (minimoAte.isBefore(c.getInicio()) || minimoAte.isAfter(c.getInicio().plusMonths(60))) {
            throw invalido("minimoAte", "O fim do mínimo precisa estar entre o início da contratação e 60 meses depois.");
        }
        return minimoAte;
    }

    /** Com o bloco {@code contrato} no contrato fechado (nulo no recorrente). */
    private ContratacaoResponse resposta(ContratacaoAluno c, String planoNome) {
        return Respostas.contratacao(c, planoNome, cobrancas.contratoDe(c, LocalDate.now(Fuso.BRASILIA)));
    }

    private String nomeDoPlano(ContratacaoAluno c) {
        return planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getNome).orElse(null);
    }

    /** Valor igual ao do plano não tem motivo; valor diferente exige o motivo (texto do treinador, nunca em log). */
    private static String motivoDoValor(long valor, long valorDoPlano, String motivo) {
        if (valor == valorDoPlano) {
            return null;
        }
        String limpo = Buscas.opcional(motivo);
        if (limpo == null) {
            throw invalido("motivoValor", "Informe o motivo do valor diferente do plano.");
        }
        return limpo;
    }

    /** Contrato fechado só termina por encerrar: pausado, o saldo seria recusado e os lembretes cairiam (V098). */
    private static void exigirNaoFechada(ContratacaoAluno c) {
        if (c.fechado()) {
            throw new ConflictException("Contrato fechado não se pausa nem se retoma: encerre o contrato.",
                    "CONTRATO_FECHADO_NAO_ALTERA");
        }
    }

    private static void exigirNaoEncerrada(ContratacaoAluno c) {
        if (c.getSituacao() == ContratacaoAluno.Situacao.ENCERRADA) {
            throw new ConflictException("Esta contratação já foi encerrada.", "CONTRATACAO_ENCERRADA");
        }
    }

    private static void conferirVersao(ContratacaoAluno c, Long versao) {
        if (versao == null || !versao.equals(c.getVersao())) {
            throw new ConflictException(
                    "Outra pessoa ou aba alterou esta contratação. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
        }
    }

    private static ConflictException vigente() {
        return new ConflictException("Este aluno já tem um plano comercial contratado.", "CONTRATACAO_VIGENTE");
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados da contratação.", "CONTRATACAO_INVALIDA",
                List.of(new ApiError.FieldError(campo, mensagem)));
    }

    /** Só olha o nome da restrição: a mensagem do banco pode trazer valores. */
    static boolean violou(DataIntegrityViolationException e, String restricao) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c
                    && restricao.equals(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }
}
