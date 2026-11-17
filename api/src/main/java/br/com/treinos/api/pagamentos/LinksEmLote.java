package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.LinkEmLoteRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoLink;
import br.com.treinos.api.pagamentos.PagamentosDtos.ResultadoDoLoteDeLinks;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Gerar o link de pagamento de várias cobranças, no padrão de {@link BaixaEmLote}: até {@value PagamentosDtos#MAXIMO_DO_LOTE} ids sem
 * repetir, um resultado por item na ordem do pedido. Este bean <b>não</b> tem {@code @Transactional}: {@link LinkDePagamentoService#gerar}
 * já separa leitura, chamada ao provedor e gravação, cada uma na sua transação, e o que falha não desfaz o resto.
 * shortcut: itens em série (uma chamada à InfinitePay por vez), trocar por paralelismo limitado se o lote de 100 passar do tempo
 * de resposta aceitável.
 */
@Service
public class LinksEmLote {

    private final LinkDePagamentoService links;

    LinksEmLote(LinkDePagamentoService links) {
        this.links = links;
    }

    public ResultadoDoLoteDeLinks gerar(LinkEmLoteRequest r) {
        CodigoDoItem.exigirSemRepetidas(r.cobrancaIds());
        List<ResultadoDoLink> resultados = new ArrayList<>(r.cobrancaIds().size());
        for (UUID id : r.cobrancaIds()) {
            try {
                resultados.add(new ResultadoDoLink(id, true, null, links.gerar(id)));
            } catch (RuntimeException e) {
                resultados.add(new ResultadoDoLink(id, false, CodigoDoItem.de(e, "links"), null));
            }
        }
        return new ResultadoDoLoteDeLinks(resultados);
    }
}
