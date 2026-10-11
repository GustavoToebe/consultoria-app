package br.com.treinos.api.biblioteca.dto;

import br.com.treinos.api.biblioteca.CategoriaErgogenico;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public final class ErgogenicoDtos {

    private ErgogenicoDtos() { }

    /** Só o que está no rótulo: sem dose, ciclo nem indicação. */
    public record ErgogenicoRequest(
            @NotNull CategoriaErgogenico categoria,
            @NotBlank @Size(max = 120) String nome,
            @Size(max = 160) String principioAtivo,
            @Size(max = 40) String concentracao,
            @Size(max = 40) String apresentacao,
            @Size(max = 500) String observacao) {
    }

    public record ErgogenicoResponse(UUID id, CategoriaErgogenico categoria, String nome, String principioAtivo,
                                     String concentracao, String apresentacao, String observacao) {
    }
}
