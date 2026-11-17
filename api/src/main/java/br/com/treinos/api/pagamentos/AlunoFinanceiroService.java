package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.ContratacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoDoAluno;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * O financeiro do aluno logado, sempre o da sessão. Mostra o plano contratado, as cobranças em aberto e as últimas 24 do
 * histórico (pagas, estornadas, contestadas; as canceladas não aparecem). Nunca leva observação, motivo, quem deu a baixa
 * nem o provedor.
 */
@Service
public class AlunoFinanceiroService {

    private static final List<CobrancaAluno.Situacao> NO_HISTORICO = List.of(CobrancaAluno.Situacao.PAGA,
            CobrancaAluno.Situacao.ESTORNADA, CobrancaAluno.Situacao.CONTESTADA);

    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;
    private final PlanoComercialRepository planos;
    private final CredencialPagamentoRepository credenciais;
    private final InfinitePayProperties infinitePay;
    private final FormasDeRecebimentoService formas;

    public AlunoFinanceiroService(ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas,
                                  PlanoComercialRepository planos, CredencialPagamentoRepository credenciais,
                                  InfinitePayProperties infinitePay, FormasDeRecebimentoService formas) {
        this.formas = formas;
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.planos = planos;
        this.credenciais = credenciais;
        this.infinitePay = infinitePay;
    }





    @Transactional(readOnly = true)
    public FinanceiroDoAluno meu(UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        List<CobrancaAluno> abertas = cobrancas.findByAlunoIdAndSituacaoOrderByVencimentoAscIdAsc(alunoId,
                CobrancaAluno.Situacao.ABERTA);
        PlanoDoAluno plano = contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA)
                .map(c -> {
                    Optional<PlanoComercial> comercial = planos.findById(c.getPlanoComercialId());
                    return new PlanoDoAluno(c.getId(), comercial.map(PlanoComercial::getNome).orElse(null),
                            c.getValorCentavos(), c.getPeriodicidade(), c.getSituacao(),
                            proximoVencimento(abertas, c.getId()), comercial.map(PlanoComercial::getLinkDePagamento).orElse(null));
                })
                .orElse(null);
        List<CobrancaDoAluno> historico = cobrancas
                .findTop24ByAlunoIdAndSituacaoInOrderByCompetenciaDescIdDesc(alunoId, NO_HISTORICO).stream()
                .map(c -> Respostas.cobrancaDoAluno(c, hoje)).toList();
        // O módulo ligado já vale (o controller é fechado por ele); falta a InfinitePay ligada e a credencial do treinador.
        boolean pagamentoOnline = infinitePay.habilitado() && credenciais.existsByProvedor(RecebimentoOnlineService.PROVEDOR);
        // Do aluno todo: o link próprio só vale numa mensalidade em aberto e o Pix, numa cobrança em aberto (qualquer tipo).
        boolean mensalidadeAberta = abertas.stream().anyMatch(c -> c.getTipo() == CobrancaAluno.Tipo.MENSALIDADE);
        boolean planoTemLink = plano != null && plano.linkDePagamento() != null && mensalidadeAberta;
        List<FormasDePagamentoDoAluno.Forma> formasDePagamento = FormasDePagamentoDoAluno.decidir(formas.ligadas(),
                pagamentoOnline, planoTemLink, !abertas.isEmpty());
        return new FinanceiroDoAluno(plano, abertas.stream().map(c -> Respostas.cobrancaDoAluno(c, hoje)).toList(), historico,
                pagamentoOnline, formasDePagamento);
    }

    /**
     * O Pix copia e cola de uma cobrança do próprio aluno (inclusive a avulsa), com o valor e o identificador tirados da
     * cobrança no servidor. Cobrança de outro aluno ou de outra consultoria é 404; cobrança que não está aberta ou Pix desligado
     * ou sem configuração é 409 {@code PIX_INDISPONIVEL} (mensagem fixa).
     */
    @Transactional(readOnly = true)
    public String codigoPix(UsuarioAutenticado eu, UUID cobrancaId) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        CobrancaAluno c = cobrancas.findById(cobrancaId).filter(x -> x.getAlunoId().equals(alunoId))
                .orElseThrow(() -> new NaoEncontradoException("Cobrança não encontrada."));
        return FormasDePagamentoDoAluno.codigoPix(formas.ligadas(), c.getId(), c.getValorCentavos(),
                c.getSituacao() == CobrancaAluno.Situacao.ABERTA)
                .orElseThrow(() -> new ConflictException("O Pix não está disponível para esta cobrança.", "PIX_INDISPONIVEL"));
    }

    /** O da mensalidade aberta mais próxima desta contratação: a cobrança de saída não é "o próximo vencimento do plano". */
    private static LocalDate proximoVencimento(List<CobrancaAluno> abertas, UUID contratacaoId) {
        return abertas.stream().filter(a -> a.getTipo() == CobrancaAluno.Tipo.MENSALIDADE
                && a.getContratacaoId().equals(contratacaoId)).map(CobrancaAluno::getVencimento).findFirst().orElse(null);
    }

    @Transactional(readOnly = true)
    public Optional<ContratacaoResponse> minhaContratacao(UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        return contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA)
                .map(c -> Respostas.contratacao(c, planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getNome).orElse(null)));
    }




}
