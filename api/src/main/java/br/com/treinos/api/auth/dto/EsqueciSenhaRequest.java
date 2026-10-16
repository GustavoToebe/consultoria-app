package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EsqueciSenhaRequest(
        @NotBlank @Email @Size(max = 254) String email,
        /** Token do Turnstile (uso único); só é exigido com a verificação humana ligada. */
        @Size(max = 2048) String turnstileToken) {
    @Override
    public String toString() {
        return "EsqueciSenhaRequest[***]";
    }
}
