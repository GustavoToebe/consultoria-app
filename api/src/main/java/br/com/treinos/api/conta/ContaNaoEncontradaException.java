package br.com.treinos.api.conta;

import br.com.treinos.api.web.ApiException;
import org.springframework.http.HttpStatus;

/** A consultoria ainda não tem dados comerciais (404 {@code CONTA_NAO_ENCONTRADA}). */
public class ContaNaoEncontradaException extends ApiException {

    public ContaNaoEncontradaException() {
        super(HttpStatus.NOT_FOUND, "Os dados da conta ainda não estão disponíveis.", "CONTA_NAO_ENCONTRADA");
    }
}
