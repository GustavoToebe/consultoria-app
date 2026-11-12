package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.pagamentos.PagamentosDtos.BaixaEmLoteRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ItemDoLote;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoItem;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoLote;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Registrar pagamentos em lote: o mesmo registro manual para até {@value #MAXIMO_DE_ITENS} cobranças, cada uma na sua
 * transação ({@link BaixaManualDeUma}). Este bean <b>não</b> tem {@code @Transactional}: o que falha não desfaz o que já
 * gravou, e o resultado diz item a item. Repetir o lote não duplica nada (a baixa é idempotente e a versão vale). Cobrança
 * que não existe e a de outra consultoria dão o mesmo código, para não revelar a existência.
 */
@Service
public class BaixaEmLote {

    public static final int MAXIMO_DE_ITENS = 100;
    static final String NAO_ENCONTRADA = "COBRANCA_NAO_ENCONTRADA";
    static final String JA_ESTAVA_PAGA = "JA_ESTAVA_PAGA";

    private static final Logger log = LoggerFactory.getLogger(BaixaEmLote.class);

    private final BaixaManualDeUma baixaManual;

    BaixaEmLote(BaixaManualDeUma baixaManual) {
        this.baixaManual = baixaManual;
    }

    public ResultadoDoLote baixar(BaixaEmLoteRequest r, UUID usuarioId) {
        if (r.itens().stream().map(ItemDoLote::cobrancaId).distinct().count() != r.itens().size()) {
            throw new BadRequestException("O lote repete uma cobrança.", "LOTE_INVALIDO");
        }
        CobrancaService.exigirDadosDaBaixa(r.data(), r.forma(), LocalDate.now(Fuso.BRASILIA));
        String observacao = Buscas.opcional(r.observacao());
        List<ResultadoDoItem> resultados = new ArrayList<>(r.itens().size());
        for (ItemDoLote item : r.itens()) {
            resultados.add(um(item, r, observacao, usuarioId));
        }
        return new ResultadoDoLote(resultados);
    }

    private ResultadoDoItem um(ItemDoLote item, BaixaEmLoteRequest r, String observacao, UUID usuarioId) {
        try {
            boolean gravou = baixaManual.baixar(item.cobrancaId(), r.data(), r.forma(), observacao, item.versao(), usuarioId);
            // Já paga antes (online ou por outro membro): continua paga com a forma e a data de antes; a tela avisa.
            return new ResultadoDoItem(item.cobrancaId(), true, gravou ? null : JA_ESTAVA_PAGA);
        } catch (RuntimeException e) {
            return new ResultadoDoItem(item.cobrancaId(), false, codigoDe(e));
        }
    }

    /** Só o código estável: a mensagem e o corpo da exceção (que podem ter nome ou valor) nunca saem nem vão ao log. */
    private static String codigoDe(RuntimeException e) {
        if (e instanceof ApiException api) {
            if (api.getStatus().value() == 404) return NAO_ENCONTRADA;
            if (api.getCodigo() != null && !api.getCodigo().isBlank()) return api.getCodigo();
        } else if (e instanceof ObjectOptimisticLockingFailureException) {
            return "CONFLITO_EDICAO";
        }
        log.warn("Falha inesperada num item do lote de baixas: {}", e.getClass().getSimpleName());
        return "ERRO_INESPERADO";
    }
}
