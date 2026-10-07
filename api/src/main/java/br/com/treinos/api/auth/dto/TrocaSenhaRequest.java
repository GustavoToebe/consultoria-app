package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TrocaSenhaRequest(
        @NotBlank @Size(max = 200) String senhaAtual,
        @NotBlank @Size(max = 200) String senhaNova) {
}
