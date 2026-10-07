package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

public class NaoAutorizadoException extends ApiException {

    public NaoAutorizadoException(String message, String codigo) {
        super(HttpStatus.UNAUTHORIZED, message, codigo);
    }
}
