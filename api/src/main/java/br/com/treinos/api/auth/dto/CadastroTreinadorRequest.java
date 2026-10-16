package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CadastroTreinadorRequest(
        @NotBlank @Size(max = 120) String nomeConsultoria,
        @NotBlank @Size(max = 120) String nome,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 200) String senha,
        /** Token do Turnstile (uso único); só é exigido com a verificação humana ligada. */
        @Size(max = 2048) String turnstileToken) {
}
