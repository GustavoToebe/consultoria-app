package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 200) String senha,
        /** Só para quem ativou a verificação em duas etapas: o código do aplicativo ou um de recuperação. */
        @Size(max = 64) String codigoMfa,
        /** Token do Turnstile (uso único); só é exigido com a verificação humana ligada. */
        @Size(max = 2048) String turnstileToken,
        /** Só no primeiro acesso com a senha provisória do treinador: a senha que o aluno escolheu. */
        @Size(max = 200) String novaSenha) {
    @Override
    public String toString() {
        return "LoginRequest[email=***]";
    }
}
