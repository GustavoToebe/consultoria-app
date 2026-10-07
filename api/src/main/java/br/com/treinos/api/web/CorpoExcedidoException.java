package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

public class CorpoExcedidoException extends ApiException {

    public CorpoExcedidoException() {
        super(HttpStatus.CONTENT_TOO_LARGE, "O conteúdo enviado é maior que o permitido.", "CORPO_EXCEDIDO");
    }
}
