package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.pagamentos.PagamentosDtos.BaixaManualRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.MotivoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PaginaCobrancas;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * As cobranças vistas e mexidas pelo treinador. As mudanças de situação moram em {@link BaixaDeCobranca}; aqui ficam a
 * conferência do pedido (data da baixa, forma manual), a auditoria (só do que mudou de verdade) e as listas. O valor de
 * uma cobrança nunca vem do corpo: corpo com campo a mais é ignorado.
 */
@Service
public class CobrancaService {

    public static final int TAMANHO_PAGINA = 50;
    private static final LocalDate PRIMEIRO_DIA = LocalDate.of(1900, 1, 1);
    private static final LocalDate ULTIMO_DIA = LocalDate.of(2999, 12, 31);
    private static final LocalDate DATA_MINIMA_DA_BAIXA = LocalDate.of(2000, 1, 1);

    private final CobrancaAlunoRepository cobrancas;
    private final AlunoRepository alunos;
    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;

    public CobrancaService(CobrancaAlunoRepository cobrancas, AlunoRepository alunos, BaixaDeCobranca baixa,
                           Auditoria auditoria) {
        this.cobrancas = cobrancas;
        this.alunos = alunos;
        this.baixa = baixa;
        this.auditoria = auditoria;
    }

    /**
     * {@code situacao}: TODAS (padrão), VENCIDA (aberta com vencimento anterior a hoje) ou uma situação gravada; ABERTA
     * inclui as vencidas. Filtro por vencimento. Abertas e vencidas vêm das mais antigas; o resto, das mais recentes.
     * {@code responsavelId} nulo = todos os alunos; preenchido = só os alunos dele ("Meus").
     */
    @Transactional(readOnly = true)
    public PaginaCobrancas listar(String situacao, LocalDate de, LocalDate ate, UUID responsavelId, int pagina) {
        String filtro = situacao == null || situacao.isBlank() ? "TODAS" : situacao.trim().toUpperCase(Locale.ROOT);
        boolean todas = filtro.equals("TODAS");
        boolean vencidas = filtro.equals("VENCIDA");
        CobrancaAluno.Situacao gravada = CobrancaAluno.Situacao.ABERTA;
        if (!todas && !vencidas) {
            try {
                gravada = CobrancaAluno.Situacao.valueOf(filtro);
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Situação precisa ser TODAS, VENCIDA, ABERTA, PAGA, CANCELADA, ESTORNADA ou CONTESTADA.");
            }
        }
        LocalDate inicio = de == null ? PRIMEIRO_DIA : de;
        LocalDate fim = ate == null ? ULTIMO_DIA : ate;
        if (fim.isBefore(inicio)) {
            throw new BadRequestException("Período inválido.");
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        var pageable = PageRequest.of(Math.max(0, pagina), TAMANHO_PAGINA);
        boolean crescente = vencidas || (!todas && gravada == CobrancaAluno.Situacao.ABERTA);
        Page<LinhaDeCobranca> page = crescente
                ? cobrancas.listarCrescente(todas, gravada, vencidas, hoje, inicio, fim, null, responsavelId, pageable)
                : cobrancas.listarDecrescente(todas, gravada, vencidas, hoje, inicio, fim, null, responsavelId, pageable);
        return new PaginaCobrancas(page.getContent().stream().map(l -> Respostas.cobranca(l, hoje)).toList(),
                page.getTotalElements(), Math.max(0, pagina));
    }

    /** Todas as cobranças de um aluno (a ficha), da competência mais nova para a mais antiga. */
    @Transactional(readOnly = true)
    public List<CobrancaResponse> doAluno(UUID alunoId) {
        Travas.exigirAluno(alunos, alunoId);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        return cobrancas.doAluno(alunoId).stream().map(l -> Respostas.cobranca(l, hoje)).toList();
    }

    /** Repetir sobre a cobrança já paga devolve 200 sem mudar nada (nem a auditoria); versão velha numa aberta é 409. */
    @Transactional
    public CobrancaResponse baixaManual(UUID id, BaixaManualRequest r, UUID usuarioId) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        if (r.data().isAfter(hoje) || r.data().isBefore(DATA_MINIMA_DA_BAIXA)) {
            throw invalida("data", "A data do pagamento não pode ser futura.");
        }
        if (!r.forma().manual()) {
            throw invalida("forma", "Escolha dinheiro, Pix direto, transferência ou outro.");
        }
        var resultado = baixa.baixar(id, new BaixaDeCobranca.Baixa(CobrancaAluno.MANUAL, r.forma(), r.data(), usuarioId,
                Buscas.opcional(r.observacao()), r.versao()));
        if (resultado.mudou()) {
            auditoria.registrarEvento("PAGAMENTO_MANUAL_REGISTRADO", "COBRANCA", id, "Registrou o pagamento de uma cobrança.");
        }
        return resposta(id, hoje);
    }

    @Transactional
    public CobrancaResponse desfazerBaixa(UUID id, MotivoRequest r) {
        var resultado = baixa.desfazerBaixa(id, r.motivo().trim(), r.versao());
        if (resultado.mudou()) {
            auditoria.registrarEvento("COBRANCA_BAIXA_DESFEITA", "COBRANCA", id, "Desfez a baixa de uma cobrança.");
        }
        return resposta(id, LocalDate.now(Fuso.BRASILIA));
    }

    @Transactional
    public CobrancaResponse cancelar(UUID id, MotivoRequest r) {
        var resultado = baixa.cancelar(id, r.motivo().trim(), r.versao());
        if (resultado.mudou()) {
            auditoria.registrarEvento("COBRANCA_CANCELADA", "COBRANCA", id, "Cancelou uma cobrança.");
        }
        return resposta(id, LocalDate.now(Fuso.BRASILIA));
    }

    private CobrancaResponse resposta(UUID id, LocalDate hoje) {
        return Respostas.cobranca(cobrancas.linha(id).orElseThrow(Travas::cobrancaNaoEncontrada), hoje);
    }

    private static ValidacaoException invalida(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados do pagamento.", "COBRANCA_INVALIDA",
                List.of(new ApiError.FieldError(campo, mensagem)));
    }
}
