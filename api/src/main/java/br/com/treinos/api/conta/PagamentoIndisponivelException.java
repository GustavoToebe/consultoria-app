package br.com.treinos.api.conta;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Pagamento online ainda não ligado (Minha conta de prévia ou Central sem Mercado Pago): 503 {@code PAGAMENTO_INDISPONIVEL}. */
public class PagamentoIndisponivelException extends ApiException {

    public PagamentoIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Pagamento online ainda não disponível.", "PAGAMENTO_INDISPONIVEL");
    }
}
