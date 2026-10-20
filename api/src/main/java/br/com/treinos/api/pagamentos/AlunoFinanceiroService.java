package br.com.treinos.api.pagamentos;

import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.FinanceiroDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoDoAluno;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
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

    public AlunoFinanceiroService(ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas,
                                  PlanoComercialRepository planos) {
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
        this.planos = planos;
    }

    @Transactional(readOnly = true)
    public FinanceiroDoAluno meu(UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        List<CobrancaAluno> abertas = cobrancas.findByAlunoIdAndSituacaoOrderByVencimentoAscIdAsc(alunoId,
                CobrancaAluno.Situacao.ABERTA);
        PlanoDoAluno plano = contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA)
                .map(c -> new PlanoDoAluno(c.getId(),
                        planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getNome).orElse(null),
                        c.getValorCentavos(), c.getPeriodicidade(), c.getSituacao(),
                        abertas.isEmpty() ? null : abertas.get(0).getVencimento()))
                .orElse(null);
        List<CobrancaDoAluno> historico = cobrancas
                .findTop24ByAlunoIdAndSituacaoInOrderByCompetenciaDescIdDesc(alunoId, NO_HISTORICO).stream()
                .map(c -> Respostas.cobrancaDoAluno(c, hoje)).toList();
        return new FinanceiroDoAluno(plano, abertas.stream().map(c -> Respostas.cobrancaDoAluno(c, hoje)).toList(), historico);
    }
}
