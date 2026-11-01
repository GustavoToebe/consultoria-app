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
import br.com.treinos.api.web.FiltrosDeLista;
import br.com.treinos.api.web.NaoEncontradoException;
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
    private final PlanoComercialRepository planos;
    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;

    public CobrancaService(CobrancaAlunoRepository cobrancas, AlunoRepository alunos, PlanoComercialRepository planos,
                           BaixaDeCobranca baixa, Auditoria auditoria) {
        this.cobrancas = cobrancas;
        this.alunos = alunos;
        this.planos = planos;
        this.baixa = baixa;
        this.auditoria = auditoria;
    }

    /** Forma da baixa no filtro: registrada pelo treinador ou confirmada por um provedor (online). */
    public enum FormaDaBaixa { MANUAL, ONLINE }

    /**
     * Filtros crus da lista ({@code GET /financeiro/cobrancas}): {@code situacao} repetível (TODAS, VENCIDA ou uma situação
     * gravada; ABERTA inclui as vencidas; vazio = todas), vencimento {@code de}/{@code ate}, {@code busca} no nome do aluno,
     * {@code alunoId}, {@code planoId} (plano comercial da contratação) e {@code forma} ({@link FormaDaBaixa}).
     */
    public record FiltroDeCobrancas(List<String> situacao, LocalDate de, LocalDate ate, String busca, String alunoId,
                                    String planoId, String forma) {

        public static FiltroDeCobrancas soSituacao(String situacao, LocalDate de, LocalDate ate) {
            return new FiltroDeCobrancas(situacao == null ? null : List.of(situacao), de, ate, null, null, null, null);
        }
    }

    /**
     * Lista paginada com os filtros (todos opcionais, combinados com E; as situações em OU). Valor desconhecido = 400
     * {@code FILTRO_INVALIDO} sem repetir o valor; aluno ou plano de outra consultoria = 404; vencimento invertido = 400.
     * Só abertas e/ou vencidas vêm das mais antigas; o resto, das mais recentes. {@code responsavelId} nulo = todos os
     * alunos; preenchido = só os alunos dele ("Meus").
     */
    @Transactional(readOnly = true)
    public PaginaCobrancas listar(FiltroDeCobrancas f, UUID responsavelId, int pagina) {
        java.util.Set<CobrancaAluno.Situacao> gravadas = java.util.EnumSet.noneOf(CobrancaAluno.Situacao.class);
        boolean todas = false;
        boolean vencidas = false;
        for (String v : FiltrosDeLista.valores(f.situacao(), "situacao")) {
            String valor = v.toUpperCase(Locale.ROOT);
            if (valor.equals("TODAS")) todas = true;
            else if (valor.equals("VENCIDA")) vencidas = true;
            else gravadas.add(FiltrosDeLista.umEnum(CobrancaAluno.Situacao.class, valor, "situacao"));
        }
        if (todas) {
            gravadas.clear();
            vencidas = false;
        }
        // ABERTA já inclui as vencidas.
        if (gravadas.contains(CobrancaAluno.Situacao.ABERTA)) vencidas = false;
        UUID alunoId = f.alunoId() == null || f.alunoId().isBlank() ? null : FiltrosDeLista.uuid(f.alunoId(), "alunoId");
        UUID planoId = f.planoId() == null || f.planoId().isBlank() ? null : FiltrosDeLista.uuid(f.planoId(), "planoId");
        FormaDaBaixa forma = FiltrosDeLista.umEnum(FormaDaBaixa.class, f.forma(), "forma");
        FiltrosDeLista.exigirPeriodo(f.de(), f.ate(), 0, "PERIODO_INVALIDO");
        if (alunoId != null) Travas.exigirAluno(alunos, alunoId);
        if (planoId != null && !planos.existsById(planoId)) throw new NaoEncontradoException("Plano não encontrado.");
        LocalDate inicio = f.de() == null ? PRIMEIRO_DIA : f.de();
        LocalDate fim = f.ate() == null ? ULTIMO_DIA : f.ate();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        var pageable = PageRequest.of(Math.max(0, pagina), TAMANHO_PAGINA);
        boolean crescente = (vencidas || !gravadas.isEmpty())
                && java.util.Set.of(CobrancaAluno.Situacao.ABERTA).containsAll(gravadas);
        boolean filtraSituacoes = !gravadas.isEmpty();
        // Coleção nunca vazia na consulta: sem situação gravada a flag desliga o trecho e a lista não importa.
        var situacoes = filtraSituacoes ? gravadas : java.util.Set.of(CobrancaAluno.Situacao.ABERTA);
        String textoForma = forma == null ? "" : forma.name();
        boolean busca = f.busca() != null && !f.busca().isBlank();
        String nome = Buscas.padrao(f.busca());
        Page<LinhaDeCobranca> page = crescente
                ? cobrancas.filtrarCrescente(filtraSituacoes, situacoes, vencidas, CobrancaAluno.Situacao.ABERTA, hoje,
                        inicio, fim, alunoId, responsavelId, planoId, textoForma, busca, nome, pageable)
                : cobrancas.filtrarDecrescente(filtraSituacoes, situacoes, vencidas, CobrancaAluno.Situacao.ABERTA, hoje,
                        inicio, fim, alunoId, responsavelId, planoId, textoForma, busca, nome, pageable);
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

    @Transactional
    public CobrancaResponse estornar(UUID id, MotivoRequest r) {
        var resultado = baixa.estornar(id, r.motivo().trim(), r.versao());
        if (resultado.mudou()) {
            auditoria.registrarEvento("COBRANCA_ESTORNADA", "COBRANCA", id, "Marcou uma cobrança como estornada.");
        }
        return resposta(id, LocalDate.now(Fuso.BRASILIA));
    }

    @Transactional
    public CobrancaResponse contestar(UUID id, MotivoRequest r) {
        var resultado = baixa.contestar(id, r.motivo().trim(), r.versao());
        if (resultado.mudou()) {
            auditoria.registrarEvento("COBRANCA_CONTESTADA", "COBRANCA", id, "Marcou uma cobrança como contestada.");
        }
        return resposta(id, LocalDate.now(Fuso.BRASILIA));
    }

    @Transactional
    public CobrancaResponse manterPaga(UUID id, MotivoRequest r) {
        var resultado = baixa.manterPaga(id, r.motivo().trim(), r.versao());
        if (resultado.mudou()) {
            auditoria.registrarEvento("COBRANCA_CONTESTACAO_ENCERRADA", "COBRANCA", id,
                    "Encerrou a contestação de uma cobrança, que continua paga.");
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
