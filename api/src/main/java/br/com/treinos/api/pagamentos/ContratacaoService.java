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
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Contratar, alterar, pausar, retomar e encerrar. Toda operação que muda a contratação trava aluno e contratação nessa
 * ordem ({@link Travas}); o valor de cada cobrança vem sempre da contratação, nunca do cliente. Pausar, retomar e
 * encerrar são idempotentes (repetir devolve o estado atual, sem auditoria nova).
 */
@Service
public class ContratacaoService {

    private final AlunoRepository alunos;
    private final PlanoComercialRepository planos;
    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;
    private final Travas travas;
    private final GeradorDeCobrancas gerador;
    private final Auditoria auditoria;

    ContratacaoService(AlunoRepository alunos, PlanoComercialRepository planos, ContratacaoAlunoRepository contratacoes,
                       CobrancaAlunoRepository cobrancas, Travas travas, GeradorDeCobrancas gerador, Auditoria auditoria) {
        this.alunos = alunos;
        this.planos = planos;
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.travas = travas;
        this.gerador = gerador;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<ContratacaoResponse> doAluno(UUID alunoId) {
        Travas.exigirAluno(alunos, alunoId);
        return contratacoes.findByAlunoIdOrderByCriadoEmDescIdDesc(alunoId).stream()
                .map(c -> Respostas.contratacao(c, nomeDoPlano(c))).toList();
    }

    @Transactional
    @Auditar(acao = "CONTRATACAO_CRIADA", entidade = "CONTRATACAO", resumo = "Contratou um plano comercial para um aluno.")
    public ContratacaoResponse contratar(UUID alunoId, ContratarRequest r) {
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
        if (r.inicio().isBefore(hoje.minusYears(10)) || r.inicio().isAfter(hoje.plusYears(1))) {
            throw invalido("inicio", "O início precisa estar entre os últimos 10 anos e o próximo ano.");
        }
        long valor = r.valorCentavos() == null ? plano.getValorCentavos() : r.valorCentavos();
        String motivo = motivoDoValor(valor, plano.getValorCentavos(), r.motivoValor());
        ContratacaoAluno contratacao = new ContratacaoAluno(alunoId, plano, valor, motivo, r.inicio(), r.diaVencimento());
        try {
            contratacoes.saveAndFlush(contratacao);
        } catch (DataIntegrityViolationException e) {
            if (violou(e, "ux_contratacao_vigente")) {
                throw vigente();
            }
            throw e;
        }
        gerador.primeira(contratacao);
        cobrancas.flush();
        return Respostas.contratacao(contratacao, plano.getNome());
    }

    /**
     * Valor e dia de vencimento novos. Refaz no lugar só as cobranças abertas que ainda não venceram (as vencidas e as
     * pagas não mudam); o vencimento refeito nunca fica antes de hoje, então a edição não gera cobrança vencida.
     */
    @Transactional
    @Auditar(acao = "CONTRATACAO_ALTERADA", entidade = "CONTRATACAO", resumo = "Alterou a contratação de um aluno.")
    public ContratacaoResponse alterar(UUID id, AlterarContratacaoRequest r) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        exigirNaoEncerrada(c);
        conferirVersao(c, r.versao());
        PlanoComercial plano = planos.findById(c.getPlanoComercialId())
                .orElseThrow(() -> new NaoEncontradoException("Plano comercial não encontrado."));
        String motivo = motivoDoValor(r.valorCentavos(), plano.getValorCentavos(), r.motivoValor());
        c.alterar(r.valorCentavos(), motivo, r.diaVencimento());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        for (CobrancaAluno aberta : cobrancas.findByContratacaoIdAndSituacaoAndVencimentoGreaterThanEqual(
                c.getId(), CobrancaAluno.Situacao.ABERTA, hoje)) {
            aberta.reajustar(r.valorCentavos(),
                    CalendarioDeCobranca.vencimento(aberta.getCompetencia(), r.diaVencimento(), hoje));
        }
        return resposta(contratacoes.saveAndFlush(c), plano.getNome());
    }

    @Transactional
    public ContratacaoResponse pausar(UUID id, Long versao) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        if (c.getSituacao() == ContratacaoAluno.Situacao.PAUSADA) {
            return resposta(c, nomeDoPlano(c));
        }
        exigirNaoEncerrada(c);
        conferirVersao(c, versao);
        c.pausar();
        return mudou(c, "CONTRATACAO_PAUSADA", "Pausou a contratação de um aluno.");
    }

    /**
     * Recomeça a contar em max(hoje, dia seguinte ao fim do período da última cobrança NÃO CANCELADA, paga ou aberta): o
     * período parado não é cobrado e retomar nunca sobrepõe período pago nem o de uma cobrança já aberta. Gera a seguinte
     * se a de maior competência não está aberta.
     */
    @Transactional
    public ContratacaoResponse retomar(UUID id, Long versao) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        if (c.getSituacao() == ContratacaoAluno.Situacao.ATIVA) {
            return resposta(c, nomeDoPlano(c));
        }
        exigirNaoEncerrada(c);
        conferirVersao(c, versao);
        LocalDate maiorNaoCancelada = cobrancas.maiorCompetenciaExceto(c.getId(), CobrancaAluno.Situacao.CANCELADA)
                .orElse(null);
        c.retomar(CalendarioDeCobranca.ancoraDaRetomada(LocalDate.now(Fuso.BRASILIA), c.getPeriodicidade(),
                maiorNaoCancelada));
        contratacoes.flush();
        gerador.garantirSeguinte(c);
        return mudou(c, "CONTRATACAO_RETOMADA", "Retomou a contratação de um aluno.");
    }

    /** Não cancela as cobranças abertas: o treinador cancela uma a uma, se quiser. Libera nova contratação. */
    @Transactional
    public ContratacaoResponse encerrar(UUID id, Long versao) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        if (c.getSituacao() == ContratacaoAluno.Situacao.ENCERRADA) {
            return resposta(c, nomeDoPlano(c));
        }
        conferirVersao(c, versao);
        c.encerrar(Instant.now());
        return mudou(c, "CONTRATACAO_ENCERRADA", "Encerrou a contratação de um aluno.");
    }

    private ContratacaoResponse mudou(ContratacaoAluno c, String acao, String resumo) {
        ContratacaoResponse resposta = resposta(contratacoes.saveAndFlush(c), nomeDoPlano(c));
        cobrancas.flush();
        auditoria.registrarEvento(acao, "CONTRATACAO", c.getId(), resumo);
        return resposta;
    }

    private static ContratacaoResponse resposta(ContratacaoAluno c, String planoNome) {
        return Respostas.contratacao(c, planoNome);
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
