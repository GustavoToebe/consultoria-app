package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Vitrine desligada ({@code TREINOS_VITRINE_HABILITADA=false}): 503 {@code VITRINE_INDISPONIVEL}. */
public class VitrineIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public VitrineIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "A vitrine não está disponível no momento.", "VITRINE_INDISPONIVEL");
    }
}
