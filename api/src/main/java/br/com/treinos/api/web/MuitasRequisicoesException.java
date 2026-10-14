package br.com.treinos.api.web;

import br.com.plataforma.comum.web.TooManyRequestsException;

/** Limite de tentativas (cadastro, convite, refresh). O {@link TratadorDoApp} devolve o {@code Retry-After}. */
public class MuitasRequisicoesException extends TooManyRequestsException {

    private static final long serialVersionUID = 1L;

    private final long segundos;

    public MuitasRequisicoesException(long segundos) {
        super("Muitas tentativas de acesso. Aguarde e tente novamente.", "LOGIN_LIMITADO");
        this.segundos = segundos;
    }

    public long segundos() {
        return segundos;
    }
}
