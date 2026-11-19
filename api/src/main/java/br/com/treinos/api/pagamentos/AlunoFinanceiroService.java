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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

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
    private final CobrancaAutomatica automatica;

    public AlunoFinanceiroService(ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas,
                                  PlanoComercialRepository planos, CredencialPagamentoRepository credenciais,
                                  InfinitePayProperties infinitePay, FormasDeRecebimentoService formas,
                                  CobrancaAutomatica automatica) {
        this.formas = formas;
        this.automatica = automatica;
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
        FormasDePagamentoDoAluno.Ligadas ligadas = formas.ligadas();
        PlanoDoAluno plano = contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA)
                .map(c -> {
                    Optional<PlanoComercial> comercial = planos.findById(c.getPlanoComercialId());
                    // Link próprio desligado nas formas: o plano não o expõe (a tela não pode abri-lo por outro caminho).
                    String link = ligadas.linkProprio() ? comercial.map(PlanoComercial::getLinkDePagamento).orElse(null) : null;
                    return new PlanoDoAluno(c.getId(), comercial.map(PlanoComercial::getNome).orElse(null),
                            c.getValorCentavos(), c.getPeriodicidade(), c.getSituacao(),
                            proximoVencimento(abertas, c.getId(), hoje), link);
                })
                .orElse(null);
        List<CobrancaAluno> pagas = cobrancas
                .findTop24ByAlunoIdAndSituacaoInOrderByCompetenciaDescIdDesc(alunoId, NO_HISTORICO);
        // D18: a mensalidade que a Kiwify cobra só informa ao aluno (sem "Pagar", link, Pix nem forma).
        Set<UUID> automaticas = automatica.contratacoesAutomaticas(Stream.concat(abertas.stream(), pagas.stream()).toList());
        List<CobrancaDoAluno> historico = pagas.stream()
                .map(c -> Respostas.cobrancaDoAluno(c, hoje, CobrancaAutomatica.eh(c, automaticas))).toList();
        // O módulo ligado já vale (o controller é fechado por ele); falta a InfinitePay ligada (no módulo e nas formas do
        // treinador) e a credencial do treinador.
        // Só mensalidades da Kiwify em aberto: nenhuma forma de pagar por aqui (o app só informa "Cobrança automática").
        boolean soDaKiwify = !abertas.isEmpty() && abertas.stream().allMatch(c -> CobrancaAutomatica.eh(c, automaticas));
        boolean pagamentoOnline = !soDaKiwify && infinitePay.habilitado() && ligadas.infinitePay()
                && credenciais.existsByProvedor(RecebimentoOnlineService.PROVEDOR);
        // Do aluno todo: o link próprio só vale numa mensalidade em aberto e o Pix, numa cobrança em aberto que não seja a de saída
        // (a saída só informa: nunca tem "Pagar").
        boolean mensalidadeAberta = abertas.stream().anyMatch(c -> c.getTipo() == CobrancaAluno.Tipo.MENSALIDADE
                && !CobrancaAutomatica.eh(c, automaticas));
        boolean pagavelAberta = abertas.stream().anyMatch(c -> c.getTipo() != CobrancaAluno.Tipo.SAIDA
                && !CobrancaAutomatica.eh(c, automaticas));
        boolean planoTemLink = plano != null && plano.linkDePagamento() != null && mensalidadeAberta;
        List<FormasDePagamentoDoAluno.Forma> formasDePagamento = FormasDePagamentoDoAluno.decidir(ligadas,
                pagamentoOnline, planoTemLink, pagavelAberta);
        return new FinanceiroDoAluno(plano, abertas.stream()
                .map(c -> Respostas.cobrancaDoAluno(c, hoje, CobrancaAutomatica.eh(c, automaticas))).toList(), historico,
                pagamentoOnline, formasDePagamento);
    }

    /**
     * O Pix copia e cola de uma cobrança do próprio aluno (inclusive a avulsa), com o valor e o identificador tirados da
     * cobrança no servidor. Cobrança de outro aluno ou de outra consultoria é 404; cobrança que não está aberta, a de saída (só
     * informa) ou Pix desligado ou sem configuração é 409 {@code PIX_INDISPONIVEL} (mensagem fixa).
     */
    @Transactional(readOnly = true)
    public String codigoPix(UsuarioAutenticado eu, UUID cobrancaId) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        CobrancaAluno c = cobrancas.findById(cobrancaId).filter(x -> x.getAlunoId().equals(alunoId))
                .orElseThrow(() -> new NaoEncontradoException("Cobrança não encontrada."));
        automatica.exigirComum(c);
        return FormasDePagamentoDoAluno.codigoPix(formas.ligadas(), c.getId(), c.getValorCentavos(),
                c.getSituacao() == CobrancaAluno.Situacao.ABERTA && c.getTipo() != CobrancaAluno.Tipo.SAIDA)
                .orElseThrow(() -> new ConflictException("O Pix não está disponível para esta cobrança.", "PIX_INDISPONIVEL"));
    }

    /**
     * O menor vencimento de hoje em diante entre as mensalidades abertas desta contratação (com a geração todo mês pode haver
     * várias vencidas, e a mais antiga não é "o próximo"). Sem nenhuma a vencer, o da mais antiga aberta: a vencida segue
     * aparecendo como "Pagamento em aberto". A cobrança de saída não é "o próximo vencimento do plano". {@code abertas} já vem
     * ordenada por vencimento.
     */
    private static LocalDate proximoVencimento(List<CobrancaAluno> abertas, UUID contratacaoId, LocalDate hoje) {
        List<LocalDate> vencimentos = abertas.stream().filter(a -> a.getTipo() == CobrancaAluno.Tipo.MENSALIDADE
                && contratacaoId.equals(a.getContratacaoId())).map(CobrancaAluno::getVencimento).toList();
        return vencimentos.stream().filter(v -> !v.isBefore(hoje)).findFirst()
                .orElse(vencimentos.isEmpty() ? null : vencimentos.get(0));
    }

    @Transactional(readOnly = true)
    public Optional<ContratacaoResponse> minhaContratacao(UsuarioAutenticado eu) {
        UUID alunoId = AlunoAppService.alunoDaSessao(eu);
        return contratacoes.findFirstByAlunoIdAndSituacaoNot(alunoId, ContratacaoAluno.Situacao.ENCERRADA)
                .map(c -> Respostas.contratacao(c, planos.findById(c.getPlanoComercialId()).map(PlanoComercial::getNome).orElse(null)));
    }




}
