package br.com.treinos.api.retorno;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Retorno ao aluno desligado ({@code TREINOS_RETORNO_HABILITADO=false}): 503 {@code RETORNO_INDISPONIVEL}. */
public class RetornoIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public RetornoIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Este recurso não está disponível no momento.", "RETORNO_INDISPONIVEL");
    }
}
