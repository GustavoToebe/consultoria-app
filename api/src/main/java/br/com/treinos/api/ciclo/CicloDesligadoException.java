package br.com.treinos.api.ciclo;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Módulo do ciclo desligado ({@code TREINOS_CICLO_HABILITADO=false}): 503 {@code CICLO_INDISPONIVEL_NO_APP}. */
public class CicloDesligadoException extends ApiException {

    private static final long serialVersionUID = 1L;

    public CicloDesligadoException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "O acompanhamento do ciclo não está disponível.", "CICLO_INDISPONIVEL_NO_APP");
    }
}
