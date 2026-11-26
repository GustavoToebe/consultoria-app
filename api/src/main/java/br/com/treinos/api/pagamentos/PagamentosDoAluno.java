package br.com.treinos.api.pagamentos;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.dto.AlunoDtos.PlanosAtivos;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.AcordoExportado;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaExportada;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoExportada;
import br.com.treinos.api.pagamentos.PagamentosDtos.EscolhaDeLembretesExportada;
import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroExportado;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembreteExportado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * O que o financeiro guarda de um aluno, para a privacidade e para a saída dele da consultoria. Roda sempre, com o módulo
 * ligado ou não (a flag só fecha os controllers): a exportação e a anonimização têm de funcionar mesmo desligado.
 *
 * <p>Os lançamentos avulsos são da consultoria, não do aluno, e não entram aqui.
 */
@Service
public class PagamentosDoAluno {

    /** Motivo gravado nas cobranças canceladas porque o aluno saiu: texto fixo, sem dado de pessoa. */
    static final String MOTIVO_DA_SAIDA = "Aluno saiu da consultoria.";

    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;
    private final PlanoComercialRepository planos;
    private final AvisoDePagamentoRepositorio avisos;
    private final LembreteDeCobrancaRepository lembretes;
    private final AlunoRepository alunos;
    private final PagamentosProperties propriedades;
    private final ResponsavelFinanceiroService responsaveis;
    private final AcordoDeCobrancaRepository acordos;
    private final Auditoria auditoria;
    private final ClienteAsaasAlunoRepository clientesAsaas;

    PagamentosDoAluno(ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas,
                      PlanoComercialRepository planos, AvisoDePagamentoRepositorio avisos,
                      LembreteDeCobrancaRepository lembretes, AlunoRepository alunos,
                      PagamentosProperties propriedades, ResponsavelFinanceiroService responsaveis,
                      AcordoDeCobrancaRepository acordos, Auditoria auditoria) {
        this(contratacoes, cobrancas, planos, avisos, lembretes, alunos, propriedades, responsaveis, acordos,
                auditoria, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    PagamentosDoAluno(ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas,
                      PlanoComercialRepository planos, AvisoDePagamentoRepositorio avisos,
                      LembreteDeCobrancaRepository lembretes, AlunoRepository alunos,
                      PagamentosProperties propriedades, ResponsavelFinanceiroService responsaveis,
                      AcordoDeCobrancaRepository acordos, Auditoria auditoria,
                      ClienteAsaasAlunoRepository clientesAsaas) {
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.planos = planos;
        this.avisos = avisos;
        this.lembretes = lembretes;
        this.alunos = alunos;
        this.propriedades = propriedades;
        this.responsaveis = responsaveis;
        this.acordos = acordos;
        this.auditoria = auditoria;
        this.clientesAsaas = clientesAsaas;
    }

    /**
     * O que o plano comercial da contratação ATIVA do aluno inclui (D1 a D4 de {@code planos-ativos-do-aluno}). Só os dois
     * booleanos, nunca valor nem nome do plano. Vazio (a ficha mostra nada, sem "não contratou") quando o financeiro está desligado
     * ({@code TREINOS_PAGAMENTOS_HABILITADO=false}), não há contratação ATIVA (pausada e encerrada não contam) ou o plano não é
     * achado. Há no máximo uma ATIVA por aluno (índice {@code ux_contratacao_vigente}), então não há o que unir.
     */
    @Transactional(readOnly = true)
    public Optional<PlanosAtivos> planosAtivos(UUID alunoId) {
        if (!propriedades.habilitado()) {
            return Optional.empty();
        }
        return contratacoes.findFirstByAlunoIdAndSituacao(alunoId, ContratacaoAluno.Situacao.ATIVA)
                .flatMap(c -> planos.findById(c.getPlanoComercialId()))
                .map(p -> new PlanosAtivos(p.isIncluiTreino(), p.isIncluiDieta()));
    }

    /**
     * Inativar pelo treinador (rota e lote) recusa o aluno com contrato fechado vigente: contratação ATIVA e {@code fechado()}, sem
     * olhar a data do fim (o contrato fechado só sai de ATIVA ao encerrar). Com o financeiro desligado não há como encerrar o
     * contrato, então não bloqueia (senão não haveria saída). Só leitura: quem chama já travou o aluno (a ordem consultoria, aluno,
     * contratação), e todo encerrar/contratar trava o mesmo aluno antes.
     */
    @Transactional(readOnly = true)
    public boolean temContratoFechadoVigente(UUID alunoId) {
        return propriedades.habilitado()
                && contratacoes.findFirstByAlunoIdAndSituacao(alunoId, ContratacaoAluno.Situacao.ATIVA)
                        .filter(ContratacaoAluno::fechado).isPresent();
    }

    /** Se o aluno tem ao menos uma cobrança ABERTA vencida (antes de hoje em Brasília). */
    @Transactional(readOnly = true)
    public boolean temCobrancaVencida(UUID alunoId) {
        return propriedades.habilitado()
                && cobrancas.existsByAlunoIdAndSituacaoAndVencimentoBefore(
                        alunoId, CobrancaAluno.Situacao.ABERTA, LocalDate.now(Fuso.BRASILIA));
    }

    /**
     * Tira a pausa por atraso (motivo ATRASO) quando não resta nenhuma cobrança ABERTA vencida; a desativação MANUAL nunca
     * sai por aqui (o update só casa com ATRASO, mesmo que a entidade em memória esteja desatualizada). Quem chama já travou
     * o aluno e alterou as cobranças na mesma transação. Desfazer a baixa nunca pausa de novo.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void reativarSeQuitou(Aluno aluno, boolean porSistema) {
        cobrancas.flush();
        if (cobrancas.existsByAlunoIdAndSituacaoAndVencimentoBefore(
                aluno.getId(), CobrancaAluno.Situacao.ABERTA, LocalDate.now(Fuso.BRASILIA))) {
            return;
        }
        if (alunos.reativarAcessoPausadoPorAtraso(aluno.getConsultoriaId(), aluno.getId()) == 0) {
            return;
        }
        aluno.reativarAcesso();
        String resumo = "Reativou o acesso do aluno automaticamente após quitação.";
        if (porSistema) {
            auditoria.registrarDoSistema(aluno.getConsultoriaId(), "ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE",
                    "ALUNO", aluno.getId(), resumo);
        } else {
            auditoria.registrarEvento("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", "ALUNO", aluno.getId(), resumo);
        }
    }

    @Transactional(readOnly = true)
    public FinanceiroExportado exportar(UUID alunoId) {
        List<ContratacaoAluno> doAluno = contratacoes.findByAlunoIdOrderByCriadoEmDescIdDesc(alunoId);
        Map<UUID, String> nomes = new HashMap<>();
        doAluno.forEach(c -> nomes.computeIfAbsent(c.getPlanoComercialId(),
                id -> planos.findById(id).map(PlanoComercial::getNome).orElse(null)));
        Instant desligadoEm = alunos.findById(alunoId).map(Aluno::getLembretesCobrancaDesligadosEm).orElse(null);
        return new FinanceiroExportado(
                doAluno.stream().map(c -> new ContratacaoExportada(c.getId(), nomes.get(c.getPlanoComercialId()),
                        c.getPeriodicidade(), c.getValorCentavos(), c.getMotivoValor(), c.getInicio(),
                        c.getDiaVencimento(), c.getSituacao(), c.getEncerradaEm(), c.getCriadoEm(), c.getMinimoAte(), c.getModoCobranca(),
                        c.getValorTotalCentavos())).toList(),
                cobrancas.findByAlunoId(alunoId).stream()
                        .sorted(Comparator.comparing((CobrancaAluno c) -> c.getCompetencia() != null ? c.getCompetencia() : c.getVencimento())
                                .reversed())
                        .map(c -> new CobrancaExportada(c.getId(), c.getContratacaoId(), c.getCompetencia(),
                                c.getVencimento(), c.getValorCentavos(), c.getSituacao(), c.getForma(), c.getProvedor(),
                                c.getPagoEm(), c.getObservacao(), c.getMotivo(), c.getTipo(), c.getDescricao(), c.getAcordoId())).toList(),
                lembretes.doAluno(alunoId).stream()
                        .map(l -> new LembreteExportado(l.getCobrancaId(), l.getTipo(), l.getSituacao(), l.getDataPrevista(),
                                l.getEnviadoEm())).toList(),
                new EscolhaDeLembretesExportada(desligadoEm == null, desligadoEm),
                responsaveis.exportar(alunoId),
                acordos.findByAlunoIdOrderByCriadoEmDescIdDesc(alunoId).stream()
                        .map(a -> new AcordoExportado(a.getId(), a.getCriadoEm(), a.getDesfeitoEm(), a.getRenegociadas(), a.getParcelas(),
                                a.getTotalCentavos())).toList());
    }

    /**
     * Inativar: a contratação vigente é encerrada e só as mensalidades e as parcelas avulsas abertas que ainda não venceram
     * (vencimento de hoje em diante, Brasília) são canceladas, com motivo fixo. As vencidas ficam em aberto (o treinador dá
     * baixa ou cancela) e a
     * cobrança de saída também (nasce com vencimento hoje: sem o filtro de tipo seria cancelada aqui). As parcelas de um acordo de
     * renegociação (RENEGOCIACAO) sobrevivem à inativação, a vencer ou vencidas: só anonimizar ou excluir a conta as cancela
     * ({@link #encerrarPorAnonimizacao}). Quem chama já trava o
     * aluno ({@code buscarParaAlterar}), a primeira trava da ordem do financeiro. Os lembretes pendentes não são tocados: o job
     * confere a cobrança antes de enviar. Roda sempre, sem permissão nem chave do financeiro.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void encerrarPorInativacao(UUID alunoId) {
        encerrarVigente(alunoId);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        cobrancas.findByAlunoIdAndSituacao(alunoId, CobrancaAluno.Situacao.ABERTA).stream()
                .filter(c -> cancelaAoInativar(c, hoje))
                .forEach(c -> c.cancelar(MOTIVO_DA_SAIDA));
        cobrancas.flush();
    }

    /**
     * Anonimizar ou excluir a conta (LGPD): a contratação vigente é encerrada e TODAS as cobranças abertas, vencidas e de
     * saída inclusive, são canceladas com motivo fixo. Mesma trava de quem chama.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void encerrarPorAnonimizacao(UUID alunoId) {
        encerrarVigente(alunoId);
        cobrancas.findByAlunoIdAndSituacao(alunoId, CobrancaAluno.Situacao.ABERTA)
                .forEach(c -> c.cancelar(MOTIVO_DA_SAIDA));
        cobrancas.flush();
    }

    /**
     * A mensalidade e a parcela avulsa abertas que ainda não venceram (D9) são as que a inativação cancela; o resto (vencida,
     * saída e parcela de acordo de renegociação, vencida ou a vencer: D2 de 18/11) fica.
     */
    static boolean cancelaAoInativar(CobrancaAluno c, LocalDate hoje) {
        return c.getTipo() != CobrancaAluno.Tipo.SAIDA && c.getTipo() != CobrancaAluno.Tipo.RENEGOCIACAO
                && !c.getVencimento().isBefore(hoje);
    }

    private void encerrarVigente(UUID alunoId) {
        contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA)
                .flatMap(c -> contratacoes.buscarParaAlterar(c.getId()))
                .ifPresent(c -> c.encerrar(Instant.now()));
    }

    /**
     * Anonimização: observação, motivos (texto do treinador) e o link do pagador saem; valores, datas e situações ficam. Na
     * caixa de entrada da InfinitePay o slug do aviso é o do link do pagador e sai junto; a transação, a referência (id da
     * cobrança) e o hash do corpo são só identificadores e não dizem nada de ninguém, então ficam até a limpeza de 180 dias.
     * Os lembretes de cobrança ficam: guardam só tipo, situação e datas (nem endereço, nem nome, nem texto). A escolha do
     * aluno de não recebê-los mora em {@code aluno} e é zerada por {@code Aluno.anonimizar}. O responsável financeiro (dado
     * pessoal de terceiro, D15) é apagado: o aluno continua existindo, então o cascade da FK não roda.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID alunoId) {
        contratacoes.findByAlunoIdOrderByCriadoEmDescIdDesc(alunoId).forEach(ContratacaoAluno::limparDadosPessoais);
        cobrancas.findByAlunoId(alunoId).forEach(CobrancaAluno::limparDadosPessoais);
        contratacoes.flush();
        cobrancas.flush();
        avisos.limparSlugsDoAluno(TenantContext.get(), alunoId);
        responsaveis.apagarDoAluno(alunoId);
        if (clientesAsaas != null) {
            clientesAsaas.deleteByAlunoId(alunoId);
        }
    }
}
