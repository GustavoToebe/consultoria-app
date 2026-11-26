package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Contrato digital desligado ({@code TREINOS_CONTRATOS_HABILITADO=false}): 503 {@code CONTRATOS_INDISPONIVEL}. */
public class ContratosIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public ContratosIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Este recurso não está disponível no momento.", "CONTRATOS_INDISPONIVEL");
    }
}
