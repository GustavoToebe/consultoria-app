package br.com.treinos.api.integracao;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Corpo de {@code POST /integracao/v1/instancias} (contrato 5.1). */
public record ProvisionarRequest(
        @NotNull UUID contratacaoId,
        UUID clienteId,
        @NotNull @Valid Instancia instancia,
        @NotNull @Valid Administrador administrador,
        @NotNull @Valid DireitosInstancia direitos) {

    public record Instancia(
            @NotBlank @Size(max = 120) String nome,
            @NotBlank @Size(max = 50) @Pattern(regexp = "[a-z0-9]+(-[a-z0-9]+)*") String slug) { }

    public record Administrador(
            @NotBlank @Size(max = 120) String nome,
            @NotBlank @Email @Size(max = 254) String email) { }
}
