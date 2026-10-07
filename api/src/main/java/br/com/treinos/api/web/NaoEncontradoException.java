package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

/** Também é a resposta para recurso de outra consultoria: 404 em vez de 403, para não revelar que existe. */
public class NaoEncontradoException extends ApiException {

    public NaoEncontradoException(String message) {
        super(HttpStatus.NOT_FOUND, message, "NAO_ENCONTRADO");
    }
}
