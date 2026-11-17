package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.BaixaEmLoteRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ItemDoLote;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoItem;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoLote;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
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
    static final String JA_ESTAVA_PAGA = "JA_ESTAVA_PAGA";

    private final BaixaManualDeUma baixaManual;

    BaixaEmLote(BaixaManualDeUma baixaManual) {
        this.baixaManual = baixaManual;
    }

    public ResultadoDoLote baixar(BaixaEmLoteRequest r, UUID usuarioId) {
        CodigoDoItem.exigirSemRepetidas(CodigoDoItem.ids(r.itens()));
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
            return new ResultadoDoItem(item.cobrancaId(), false, CodigoDoItem.de(e, "baixas"));
        }
    }
}
