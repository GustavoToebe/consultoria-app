package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.CancelarEmLoteRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ItemDoLote;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoItem;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoLote;
import br.com.treinos.api.web.Buscas;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Cancelar cobranças em lote, no padrão de {@link BaixaEmLote}: até {@value PagamentosDtos#MAXIMO_DO_LOTE} itens sem repetir, cada um
 * na sua transação ({@link CancelamentoDeUma}); o que falha não desfaz o resto e o resultado diz item a item. Este bean
 * <b>não</b> tem {@code @Transactional}. Já cancelada é {@code ok} com {@code JA_ESTAVA_CANCELADA}, sem gravar nem auditar.
 */
@Service
public class CancelamentoEmLote {

    static final String JA_ESTAVA_CANCELADA = "JA_ESTAVA_CANCELADA";

    private final CancelamentoDeUma cancelamento;

    CancelamentoEmLote(CancelamentoDeUma cancelamento) {
        this.cancelamento = cancelamento;
    }

    public ResultadoDoLote cancelar(CancelarEmLoteRequest r) {
        CodigoDoItem.exigirSemRepetidas(CodigoDoItem.ids(r.itens()));
        String motivo = Buscas.opcional(r.motivo());
        List<ResultadoDoItem> resultados = new ArrayList<>(r.itens().size());
        for (ItemDoLote item : r.itens()) {
            try {
                boolean cancelou = cancelamento.cancelar(item.cobrancaId(), motivo, item.versao());
                resultados.add(new ResultadoDoItem(item.cobrancaId(), true, cancelou ? null : JA_ESTAVA_CANCELADA));
            } catch (RuntimeException e) {
                resultados.add(new ResultadoDoItem(item.cobrancaId(), false, CodigoDoItem.de(e, "cancelamentos")));
            }
        }
        return new ResultadoDoLote(resultados);
    }
}
