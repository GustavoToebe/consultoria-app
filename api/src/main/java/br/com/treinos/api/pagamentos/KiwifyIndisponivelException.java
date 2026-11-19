package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Kiwify desligada ({@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO=false}): 503 {@code KIWIFY_INDISPONIVEL}. */
public class KiwifyIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public KiwifyIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "A integração com a Kiwify ainda não está disponível.", "KIWIFY_INDISPONIVEL");
    }
}
