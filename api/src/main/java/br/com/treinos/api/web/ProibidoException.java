package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

public class ProibidoException extends ApiException {

    public ProibidoException(String message) {
        super(HttpStatus.FORBIDDEN, message, null);
    }
}
