package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Overtraining Pay desligado ({@code TREINOS_PAGAMENTOS_ASAAS_HABILITADO=false}): 503 {@code OVERTRAINING_PAY_INDISPONIVEL}. */
public class AsaasIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public AsaasIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "O Overtraining Pay ainda não está disponível.", "OVERTRAINING_PAY_INDISPONIVEL");
    }
}
