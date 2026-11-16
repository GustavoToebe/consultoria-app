package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Loja desligada ({@code TREINOS_LOJA_HABILITADA=false} ou vitrine desligada): 503 {@code LOJA_INDISPONIVEL}. */
public class LojaIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public LojaIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "A loja não está disponível no momento.", "LOJA_INDISPONIVEL");
    }
}
