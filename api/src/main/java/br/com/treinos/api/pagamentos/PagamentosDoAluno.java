package br.com.treinos.api.pagamentos;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
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

    PagamentosDoAluno(ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas,
                      PlanoComercialRepository planos, AvisoDePagamentoRepositorio avisos,
                      LembreteDeCobrancaRepository lembretes, AlunoRepository alunos) {
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.planos = planos;
        this.avisos = avisos;
        this.lembretes = lembretes;
        this.alunos = alunos;
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
                        c.getDiaVencimento(), c.getSituacao(), c.getEncerradaEm(), c.getCriadoEm(), c.getMinimoAte())).toList(),
                cobrancas.findByAlunoId(alunoId).stream()
                        .sorted(Comparator.comparing(CobrancaAluno::getCompetencia).reversed())
                        .map(c -> new CobrancaExportada(c.getId(), c.getContratacaoId(), c.getCompetencia(),
                                c.getVencimento(), c.getValorCentavos(), c.getSituacao(), c.getForma(), c.getProvedor(),
                                c.getPagoEm(), c.getObservacao(), c.getMotivo(), c.getTipo())).toList(),
                lembretes.doAluno(alunoId).stream()
                        .map(l -> new LembreteExportado(l.getCobrancaId(), l.getTipo(), l.getSituacao(), l.getDataPrevista(),
                                l.getEnviadoEm())).toList(),
                new EscolhaDeLembretesExportada(desligadoEm == null, desligadoEm));
    }

    /**
     * Inativar: a contratação vigente é encerrada e só as mensalidades abertas que ainda não venceram (vencimento de hoje em
     * diante, Brasília) são canceladas, com motivo fixo. As vencidas ficam em aberto (o treinador dá baixa ou cancela) e a
     * cobrança de saída também (nasce com vencimento hoje: sem o filtro de tipo seria cancelada aqui). Quem chama já trava o
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

    /** A mensalidade aberta que ainda não venceu é a que a inativação cancela; o resto (vencida, saída) fica. */
    static boolean cancelaAoInativar(CobrancaAluno c, LocalDate hoje) {
        return c.getTipo() == CobrancaAluno.Tipo.MENSALIDADE && !c.getVencimento().isBefore(hoje);
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
     * aluno de não recebê-los mora em {@code aluno} e é zerada por {@code Aluno.anonimizar}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID alunoId) {
        contratacoes.findByAlunoIdOrderByCriadoEmDescIdDesc(alunoId).forEach(ContratacaoAluno::limparDadosPessoais);
        cobrancas.findByAlunoId(alunoId).forEach(CobrancaAluno::limparDadosPessoais);
        contratacoes.flush();
        cobrancas.flush();
        avisos.limparSlugsDoAluno(TenantContext.get(), alunoId);
    }
}
