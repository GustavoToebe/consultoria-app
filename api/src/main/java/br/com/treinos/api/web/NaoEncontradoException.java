package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ResourceNotFoundException;

/** Também é a resposta para recurso de outra consultoria: 404 em vez de 403, para não revelar que existe. */
public class NaoEncontradoException extends ResourceNotFoundException {

    private static final long serialVersionUID = 1L;

    public NaoEncontradoException(String message) {
        super(message, "NAO_ENCONTRADO");
    }
}
