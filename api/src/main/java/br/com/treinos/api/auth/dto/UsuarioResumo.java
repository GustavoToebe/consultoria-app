package br.com.treinos.api.auth.dto;

import br.com.treinos.api.auth.Usuario;

import java.util.UUID;

public record UsuarioResumo(UUID id, String nome, String email, String papel, @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String telefone) {

    public static UsuarioResumo de(Usuario usuario) {
        return new UsuarioResumo(usuario.getId(), usuario.getNome(), usuario.getEmail(), usuario.getPapel().name(),usuario.getTelefone());
    }
}
