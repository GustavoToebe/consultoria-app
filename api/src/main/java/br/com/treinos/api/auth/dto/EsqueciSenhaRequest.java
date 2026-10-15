package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EsqueciSenhaRequest(@NotBlank @Email @Size(max = 254) String email) {
    @Override
    public String toString() {
        return "EsqueciSenhaRequest[***]";
    }
}
