package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.pagamentos.PagamentosDtos.ItemDoLote;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.util.List;
import java.util.UUID;

/** O que os lotes do financeiro (baixa, cancelamento, link) têm em comum: o código estável por item e a recusa de id repetido. */
final class CodigoDoItem {

    static final String NAO_ENCONTRADA = "COBRANCA_NAO_ENCONTRADA";

    private static final Logger log = LoggerFactory.getLogger(CodigoDoItem.class);

    private CodigoDoItem() {
    }

    /** 400 {@code LOTE_INVALIDO} antes de qualquer efeito se o mesmo id aparece duas vezes. */
    static void exigirSemRepetidas(List<UUID> ids) {
        if (ids.stream().distinct().count() != ids.size()) {
            throw new BadRequestException("O lote repete uma cobrança.", "LOTE_INVALIDO");
        }
    }

    static List<UUID> ids(List<ItemDoLote> itens) {
        return itens.stream().map(ItemDoLote::cobrancaId).toList();
    }

    /**
     * Só o código estável: a mensagem e o corpo da exceção (que podem ter nome ou valor) nunca saem nem vão ao log. Inexistente e
     * de outra consultoria dão o mesmo código, para não revelar a existência.
     */
    static String de(RuntimeException e, String lote) {
        if (e instanceof ApiException api) {
            if (api.getStatus().value() == 404) return NAO_ENCONTRADA;
            if (api.getCodigo() != null && !api.getCodigo().isBlank()) return api.getCodigo();
        } else if (e instanceof ObjectOptimisticLockingFailureException) {
            return "CONFLITO_EDICAO";
        }
        log.warn("Falha inesperada num item do lote de {}: {}", lote, e.getClass().getSimpleName());
        return "ERRO_INESPERADO";
    }
}
