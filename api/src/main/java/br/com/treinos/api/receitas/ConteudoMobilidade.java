package br.com.treinos.api.receitas;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Modelo de mobilidade e alongamento: seções (ex.: "Alongamentos", "Mobilidade") com itens que trazem o nome, a
 * prescrição em texto ("2 x 20s cada lado") e o link do vídeo. Só modelo reutilizável: não é aplicado a aluno.
 */
public record ConteudoMobilidade(
        @Size(max = 2000) String orientacoes,
        @NotNull @Size(min = 1, max = 10) List<@NotNull @Valid Secao> secoes) {

    public record Secao(UUID uid, @Size(max = 80) String titulo,
                        @NotNull @Size(max = 40) List<@NotNull @Valid Item> itens) { }

    public record Item(UUID uid, @NotBlank @Size(max = 120) String nome, @Size(max = 120) String prescricao,
                       @Size(max = 500) String videoUrl) { }
}
