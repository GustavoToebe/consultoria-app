package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

public class ConflitoException extends ApiException {

    public ConflitoException(String message, String codigo) {
        super(HttpStatus.CONFLICT, message, codigo);
    }
}
