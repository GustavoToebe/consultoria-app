package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** O token vem do fragmento do link do e-mail; {@code codigoMfa} só para quem ativou a verificação em duas etapas. */
public record RedefinirSenhaRequest(
        @NotBlank @Size(max = 200) String token,
        @NotBlank @Size(max = 200) String novaSenha,
        @Size(max = 64) String codigoMfa) {
    @Override
    public String toString() {
        return "RedefinirSenhaRequest[***]";
    }
}
