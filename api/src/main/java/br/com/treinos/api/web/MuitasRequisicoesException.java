package br.com.treinos.api.web;

import org.springframework.http.HttpStatus;

/** Limite de tentativas (login, cadastro, convite, refresh). O handler devolve o {@code Retry-After}. */
public class MuitasRequisicoesException extends ApiException {

    private final long segundos;

    public MuitasRequisicoesException(long segundos) {
        super(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas de acesso. Aguarde e tente novamente.", "LOGIN_LIMITADO");
        this.segundos = segundos;
    }

    public long segundos() {
        return segundos;
    }
}
