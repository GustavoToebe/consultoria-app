package br.com.treinos.api.push;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Push desligado ({@code TREINOS_PUSH_HABILITADO=false}): 503 {@code PUSH_INDISPONIVEL}. */
public class PushIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public PushIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Este recurso não está disponível no momento.", "PUSH_INDISPONIVEL");
    }
}
