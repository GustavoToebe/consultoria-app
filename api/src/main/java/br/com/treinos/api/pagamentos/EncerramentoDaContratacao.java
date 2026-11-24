package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.EncerrarRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.GrupoDeAbertas;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDoEncerramento;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResumoDaSaidaDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.SaidaRequest;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Encerrar uma contratação, com cobrança de saída opcional quando ainda falta tempo para o mínimo (plano
 * {@code docs/planos/saida-e-tempo-minimo.md}). O valor da saída nunca é decidido pelo cliente em {@code FALTAM} e
 * {@code VIGENTE}: o servidor refaz a conta dentro das travas (aluno, contratação, cobranças, nessa ordem) e recusa se a tela
 * viu outra coisa. {@code OUTRO} é o único valor que vem do corpo (teto de R$ 1 milhão).
 */
@Service
public class EncerramentoDaContratacao {

    /** Motivo fixo das mensalidades canceladas pela cobrança de saída: sem dado de pessoa. */
    static final String MOTIVO_DA_SAIDA_ANTECIPADA = "Cancelada pela cobrança de saída.";
    /** Motivo fixo das cobranças futuras de um contrato fechado canceladas ao encerrá-lo (V098): sem dado de pessoa. */
    static final String MOTIVO_DO_CONTRATO_ENCERRADO = "Cancelada ao encerrar o contrato.";

    private final AlunoRepository alunos;
    private final PlanoComercialRepository planos;
    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;
    private final Travas travas;
    private final Auditoria auditoria;

    EncerramentoDaContratacao(AlunoRepository alunos, PlanoComercialRepository planos,
                              ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas, Travas travas,
                              Auditoria auditoria) {
        this.alunos = alunos;
        this.planos = planos;
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.travas = travas;
        this.auditoria = auditoria;
    }

    /** Leitura: o que o encerramento faria agora. Contratação já encerrada = 409 (não há o que prever). */
    @Transactional(readOnly = true)
    public PreviaDoEncerramento previa(UUID contratacaoId) {
        ContratacaoAluno c = contratacoes.findById(contratacaoId).orElseThrow(Travas::contratacaoNaoEncontrada);
        exigirNaoEncerrada(c);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        var calculo = CalculoDaSaida.calcular(c, hoje, cobrancas.mensalidadesDaContratacao(c.getId(),
                CobrancaAluno.Tipo.MENSALIDADE, CobrancaAluno.NAO_COBREM_PERIODO), maiorCompetencia(c));
        String regra = planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getRegraDeSaida).orElse(null);
        Instant agora = Instant.now();
        // Contrato fechado (V098): as mensalidades não existem; o que o encerrar cancela são as cobranças futuras do contrato.
        List<CobrancaAluno> abertasDoContrato = c.fechado() ? abertasDoContrato(cobrancas.doContrato(c.getId())) : List.of();
        List<CobrancaAluno> doContratoACancelar = abertasDoContrato.stream().filter(m -> !m.getVencimento().isBefore(hoje)).toList();
        List<CobrancaAluno> doContratoVencidas = abertasDoContrato.stream().filter(m -> m.getVencimento().isBefore(hoje)).toList();
        List<CobrancaAluno> aCancelar = c.fechado() ? doContratoACancelar : calculo.aCancelar();
        int comLink = (int) aCancelar.stream().filter(m -> linkVivo(m, agora)).count();
        return new PreviaDoEncerramento(c.getId(), c.getPeriodicidade(), c.getSituacao(), c.getMinimoAte(),
                calculo.mesesQueFaltam(), regra, grupo(calculo.vencidas()), grupo(calculo.aCancelar()),
                grupo(calculo.aVencerQueFicam()),
                aCancelar.stream().map(CobrancaAluno::getId).toList(), comLink, calculo.mesesNaoGerados(),
                calculo.valorNaoGerados(), CalculoDaSaida.opcoes(c, calculo),
                doContratoACancelar.stream().map(EncerramentoDaContratacao::naPrevia).toList(),
                doContratoVencidas.stream().map(EncerramentoDaContratacao::naPrevia).toList());
    }

    /**
     * Leitura, por aluno: o que inativá-lo faz com o financeiro. Cancela as mensalidades (de qualquer contratação) e as
     * parcelas avulsas abertas que ainda não venceram; as vencidas e a cobrança de saída ficam. {@code mesesQueFaltam} > 0 = o mínimo se perde.
     * {@code contratoFechadoVigente} (a contratação ATIVA fechada) avisa que inativar será recusado até encerrar o contrato.
     */
    @Transactional(readOnly = true)
    public ResumoDaSaidaDoAluno resumoDoAluno(UUID alunoId) {
        Travas.exigirAluno(alunos, alunoId);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        List<CobrancaAluno> abertas = cobrancas.findByAlunoIdAndSituacao(alunoId, CobrancaAluno.Situacao.ABERTA);
        List<CobrancaAluno> aCancelar = abertas.stream().filter(m -> PagamentosDoAluno.cancelaAoInativar(m, hoje)).toList();
        List<CobrancaAluno> ficam = abertas.stream().filter(m -> !PagamentosDoAluno.cancelaAoInativar(m, hoje)).toList();
        LocalDate minimoAte = null;
        int meses = 0;
        var vigente = contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA);
        if (vigente.isPresent() && vigente.get().getMinimoAte() != null) {
            ContratacaoAluno c = vigente.get();
            minimoAte = c.getMinimoAte();
            meses = CalculoDaSaida.calcular(c, hoje, cobrancas.mensalidadesDaContratacao(c.getId(),
                    CobrancaAluno.Tipo.MENSALIDADE, CobrancaAluno.NAO_COBREM_PERIODO), maiorCompetencia(c)).mesesQueFaltam();
        }
        var fechado = contratacoes.findFirstByAlunoIdAndSituacao(alunoId, ContratacaoAluno.Situacao.ATIVA)
                .filter(ContratacaoAluno::fechado).map(f -> new PagamentosDtos.ContratoFechadoVigente(f.getId())).orElse(null);
        return new ResumoDaSaidaDoAluno(grupo(aCancelar), grupo(ficam), minimoAte, meses, fechado);
    }

    /**
     * Sem {@code saida} (ou {@code NAO_COBRAR}) encerra como sempre, mantendo as abertas. Com saída, e sob as travas: refaz a
     * conta, encerra a contratação primeiro, cancela as mensalidades a vencer direto na entidade (nunca por
     * {@link BaixaDeCobranca#cancelar}, que geraria a seguinte com a contratação ainda ativa) e cria a cobrança de saída.
     */
    @Transactional
    public ContratacaoResponse encerrar(UUID id, EncerrarRequest r) {
        ContratacaoAluno c = travas.daContratacao(id).contratacao();
        SaidaRequest saida = r.saida() == null || r.saida().opcao() == OpcaoDeSaida.NAO_COBRAR ? null : r.saida();
        if (c.getSituacao() == ContratacaoAluno.Situacao.ENCERRADA) {
            if (saida != null) {
                throw encerrada();
            }
            return resposta(c);
        }
        conferirVersao(c, r.versao());
        if (c.fechado()) {
            return encerrarContrato(c, r.saida());
        }
        if (saida == null) {
            c.encerrar(Instant.now());
            return gravar(c, null);
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate vencimento = vencimentoDaSaida(saida, hoje);
        long valor = valorDaSaida(c, saida);
        CobrancaAluno nova;
        if (saida.opcao() == OpcaoDeSaida.OUTRO) {
            c.encerrar(Instant.now());
            nova = CobrancaAluno.saida(c, hoje, vencimento, valor);
        } else {
            nova = encerrarComConta(c, saida, hoje, vencimento, valor);
        }
        return gravar(c, nova);
    }

    /**
     * Contrato fechado (V098): só {@code NAO_COBRAR} e {@code OUTRO}. Sempre cancela as cobranças do contrato ABERTAS com vencimento de
     * hoje em diante (as vencidas e as pagas ficam), direto na entidade e depois de encerrar a contratação (nunca por
     * {@link BaixaDeCobranca#cancelar}), e em {@code OUTRO} cria a saída (a multa) com valor e vencimento do treinador. O servidor
     * confere o conjunto que a tela viu ({@code saida.cobrancasACancelar}; sem {@code saida} vale o conjunto vazio): se mudou,
     * 409 {@code VALOR_DA_SAIDA_MUDOU} e nada é gravado.
     */
    private ContratacaoResponse encerrarContrato(ContratacaoAluno c, SaidaRequest saida) {
        OpcaoDeSaida opcao = saida == null ? OpcaoDeSaida.NAO_COBRAR : saida.opcao();
        if (opcao == OpcaoDeSaida.FALTAM || opcao == OpcaoDeSaida.VIGENTE) {
            throw invalido("saida.opcao", "Esta opção não vale em contrato fechado.");
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate vencimento = null;
        long valor = 0;
        if (opcao == OpcaoDeSaida.OUTRO) {
            vencimento = vencimentoDaSaida(saida, hoje);
            valor = valorDaSaida(c, saida);
        }
        List<CobrancaAluno> futuras = abertasDoContrato(cobrancas.doContratoTravadas(c.getId())).stream()
                .filter(m -> !m.getVencimento().isBefore(hoje)).toList();
        Set<UUID> vistos = saida == null || saida.cobrancasACancelar() == null ? Set.of() : new HashSet<>(saida.cobrancasACancelar());
        if (!vistos.equals(futuras.stream().map(CobrancaAluno::getId).collect(Collectors.toSet()))) {
            throw mudou();
        }
        c.encerrar(Instant.now());
        futuras.forEach(m -> m.cancelar(MOTIVO_DO_CONTRATO_ENCERRADO));
        return gravar(c, opcao == OpcaoDeSaida.OUTRO ? CobrancaAluno.saida(c, hoje, vencimento, valor) : null);
    }

    private static List<CobrancaAluno> abertasDoContrato(List<CobrancaAluno> doContrato) {
        return doContrato.stream().filter(m -> m.getSituacao() == CobrancaAluno.Situacao.ABERTA).toList();
    }

    private static PagamentosDtos.CobrancaDoContratoNaPrevia naPrevia(CobrancaAluno c) {
        return new PagamentosDtos.CobrancaDoContratoNaPrevia(c.getId(), c.getDescricao(), c.getVencimento(), c.getValorCentavos());
    }

    private ContratacaoResponse resposta(ContratacaoAluno c) {
        return Respostas.contratacao(c, nomeDoPlano(c), cobrancas.contratoDe(c, LocalDate.now(Fuso.BRASILIA)));
    }

    /** FALTAM e VIGENTE: confere a conta do servidor com o que a tela viu, cancela as a vencer (FALTAM) e devolve a saída. */
    private CobrancaAluno encerrarComConta(ContratacaoAluno c, SaidaRequest saida, LocalDate hoje, LocalDate vencimento,
                                           long valor) {
        var calculo = CalculoDaSaida.calcular(c, hoje, cobrancas.mensalidadesDaContratacaoTravadas(c.getId(),
                CobrancaAluno.Tipo.MENSALIDADE, CobrancaAluno.NAO_COBREM_PERIODO), maiorCompetencia(c));
        if (!calculo.elegivel()) {
            throw invalido("saida.opcao", "Esta opção só vale em plano mensal com tempo mínimo.");
        }
        Set<UUID> vistos = saida.cobrancasACancelar() == null ? Set.of() : new HashSet<>(saida.cobrancasACancelar());
        if (saida.opcao() == OpcaoDeSaida.FALTAM) {
            if (calculo.mesesQueFaltam() == 0) {
                throw invalido("saida.opcao", "Não faltam meses para o mínimo.");
            }
            Set<UUID> doServidor = calculo.aCancelar().stream().map(CobrancaAluno::getId).collect(Collectors.toSet());
            if (valor != calculo.valorFaltam() || !vistos.equals(doServidor)) {
                throw mudou();
            }
            c.encerrar(Instant.now());
            calculo.aCancelar().forEach(m -> m.cancelar(MOTIVO_DA_SAIDA_ANTECIPADA));
        } else {
            boolean disponivel = c.getSituacao() == ContratacaoAluno.Situacao.ATIVA && !calculo.mesVigenteCoberto();
            if (!disponivel || valor != c.getValorCentavos() || !vistos.isEmpty()) {
                throw mudou();
            }
            c.encerrar(Instant.now());
        }
        return CobrancaAluno.saida(c, hoje, vencimento, valor);
    }

    private ContratacaoResponse gravar(ContratacaoAluno c, CobrancaAluno saida) {
        ContratacaoResponse resposta;
        try {
            contratacoes.saveAndFlush(c);
            if (saida != null) {
                cobrancas.saveAndFlush(saida);
            }
            cobrancas.flush();
            resposta = resposta(c);
        } catch (DataIntegrityViolationException e) {
            if (ContratacaoService.violou(e, "ux_cobranca_saida_viva")) {
                throw encerrada();
            }
            throw e;
        }
        auditoria.registrarEvento("CONTRATACAO_ENCERRADA", "CONTRATACAO", c.getId(), "Encerrou a contratação de um aluno.");
        if (saida != null) {
            auditoria.registrarEvento("COBRANCA_DE_SAIDA_CRIADA", "COBRANCA", saida.getId(), "Criou uma cobrança de saída.");
        }
        return resposta;
    }

    /** O valor da saída é sempre maior que zero (o banco exige) e até R$ 1 milhão; 422 sem repetir o número. */
    private static long valorDaSaida(ContratacaoAluno c, SaidaRequest saida) {
        if (!c.fechado() && !c.getPeriodicidade().recorrente()) {
            throw invalido("saida.opcao", "Parcela única não tem cobrança de saída.");
        }
        Long valor = saida.valorCentavos();
        if (valor == null || valor <= 0 || valor > CalculoDaSaida.VALOR_MAXIMO) {
            throw invalido("saida.valorCentavos", "Informe um valor maior que zero, até R$ 1.000.000,00.");
        }
        return valor;
    }

    /** Padrão hoje; de hoje a hoje + 1 ano (Brasília). O mesmo dia ainda não é vencida. */
    private static LocalDate vencimentoDaSaida(SaidaRequest saida, LocalDate hoje) {
        LocalDate v = saida.vencimento() == null ? hoje : saida.vencimento();
        if (v.isBefore(hoje) || v.isAfter(hoje.plusYears(1))) {
            throw invalido("saida.vencimento", "O vencimento vai de hoje até um ano à frente.");
        }
        return v;
    }

    private LocalDate maiorCompetencia(ContratacaoAluno c) {
        return cobrancas.maiorCompetencia(c.getId()).orElse(null);
    }

    private static boolean linkVivo(CobrancaAluno c, Instant agora) {
        return c.getLinkUrl() != null && (c.getLinkValidoAte() == null || c.getLinkValidoAte().isAfter(agora));
    }

    private static GrupoDeAbertas grupo(List<CobrancaAluno> cobrancas) {
        long soma = 0;
        for (CobrancaAluno c : cobrancas) {
            soma = Math.addExact(soma, c.getValorCentavos());
        }
        return new GrupoDeAbertas(cobrancas.size(), soma);
    }

    private String nomeDoPlano(ContratacaoAluno c) {
        return planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getNome).orElse(null);
    }

    private static void exigirNaoEncerrada(ContratacaoAluno c) {
        if (c.getSituacao() == ContratacaoAluno.Situacao.ENCERRADA) {
            throw encerrada();
        }
    }

    private static ConflictException encerrada() {
        return new ConflictException("Esta contratação já foi encerrada.", "CONTRATACAO_ENCERRADA");
    }

    /** A tela viu outra conta (valor, cobranças a cancelar ou opção que deixou de valer): ela refaz a prévia. */
    private static ConflictException mudou() {
        return new ConflictException("A conta da saída mudou desde que você a viu. Confira a prévia de novo.",
                "VALOR_DA_SAIDA_MUDOU");
    }

    private static void conferirVersao(ContratacaoAluno c, Long versao) {
        if (versao == null || !versao.equals(c.getVersao())) {
            throw new ConflictException(
                    "Outra pessoa ou aba alterou esta contratação. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
        }
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados da saída.", "CONTRATACAO_INVALIDA",
                List.of(new ApiError.FieldError(campo, mensagem)));
    }
}
