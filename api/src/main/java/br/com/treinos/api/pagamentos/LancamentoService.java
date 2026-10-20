package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.LancamentoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.LancamentoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.PaginaLancamentos;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Entradas e saídas avulsas da consultoria (aluguel, equipamento, um recebimento fora das cobranças...). Não têm aluno,
 * não entram na exportação do aluno e a descrição nunca vai a log nem a auditoria. Recebimento de cobrança não vira
 * lançamento: o painel soma as duas fontes, cada uma com o seu rótulo.
 */
@Service
public class LancamentoService {

    public static final int TAMANHO_PAGINA = 50;
    private static final LocalDate PRIMEIRO_DIA = LocalDate.of(1900, 1, 1);
    private static final LocalDate ULTIMO_DIA = LocalDate.of(2999, 12, 31);

    private final LancamentoFinanceiroRepository lancamentos;
    private final Auditoria auditoria;

    public LancamentoService(LancamentoFinanceiroRepository lancamentos, Auditoria auditoria) {
        this.lancamentos = lancamentos;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public PaginaLancamentos listar(LocalDate de, LocalDate ate, int pagina) {
        LocalDate inicio = de == null ? PRIMEIRO_DIA : de;
        LocalDate fim = ate == null ? ULTIMO_DIA : ate;
        if (fim.isBefore(inicio)) {
            throw new BadRequestException("Período inválido.");
        }
        var page = lancamentos.findByDataBetweenOrderByDataDescCriadoEmDescIdDesc(inicio, fim,
                PageRequest.of(Math.max(0, pagina), TAMANHO_PAGINA));
        return new PaginaLancamentos(page.getContent().stream().map(Respostas::lancamento).toList(),
                page.getTotalElements(), Math.max(0, pagina));
    }

    @Transactional
    @Auditar(acao = "LANCAMENTO_FINANCEIRO_CRIADO", entidade = "LANCAMENTO_FINANCEIRO", resumo = "Registrou um lançamento financeiro.")
    public LancamentoResponse criar(LancamentoRequest r, UUID usuarioId) {
        LancamentoFinanceiro l = new LancamentoFinanceiro(usuarioId);
        preencher(l, r);
        return Respostas.lancamento(lancamentos.saveAndFlush(l));
    }

    @Transactional
    @Auditar(acao = "LANCAMENTO_FINANCEIRO_ALTERADO", entidade = "LANCAMENTO_FINANCEIRO", resumo = "Editou um lançamento financeiro.")
    public LancamentoResponse alterar(UUID id, LancamentoRequest r) {
        LancamentoFinanceiro l = buscar(id);
        conferirVersao(l, r.versao());
        preencher(l, r);
        return Respostas.lancamento(lancamentos.saveAndFlush(l));
    }

    @Transactional
    public void excluir(UUID id, Long versao) {
        LancamentoFinanceiro l = buscar(id);
        conferirVersao(l, versao);
        lancamentos.delete(l);
        lancamentos.flush();
        auditoria.registrarEvento("LANCAMENTO_FINANCEIRO_EXCLUIDO", "LANCAMENTO_FINANCEIRO", id,
                "Excluiu um lançamento financeiro.");
    }

    private void preencher(LancamentoFinanceiro l, LancamentoRequest r) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        if (r.data().isBefore(hoje.minusYears(10)) || r.data().isAfter(hoje.plusYears(1))) {
            throw new ValidacaoException("Confira os dados do lançamento.", "LANCAMENTO_INVALIDO",
                    List.of(new ApiError.FieldError("data", "A data precisa estar entre os últimos 10 anos e o próximo ano.")));
        }
        l.preencher(r.data(), r.descricao().trim(), r.valorCentavos(), r.tipo(), Buscas.opcional(r.categoria()));
    }

    private LancamentoFinanceiro buscar(UUID id) {
        return lancamentos.findById(id).orElseThrow(() -> new NaoEncontradoException("Lançamento não encontrado."));
    }

    private static void conferirVersao(LancamentoFinanceiro l, Long versao) {
        if (versao == null || !versao.equals(l.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este lançamento. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }
}
