package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

public class ProibidoException extends ApiException {

    public ProibidoException(String message) {
        super(HttpStatus.FORBIDDEN, message, null);
    }

    public ProibidoException(String message, String codigo) {
        super(HttpStatus.FORBIDDEN, message, codigo);
    }
}
