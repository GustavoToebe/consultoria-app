package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** InfinitePay desligada ({@code TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO=false}): 503 {@code RECEBIMENTO_ONLINE_INDISPONIVEL}. */
public class RecebimentoOnlineIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public RecebimentoOnlineIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "O recebimento online ainda não está disponível.",
                "RECEBIMENTO_ONLINE_INDISPONIVEL");
    }
}
