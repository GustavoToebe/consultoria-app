package br.com.treinos.api.receitas;

import br.com.treinos.api.treino.ConteudoTreino.Serie;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Conteúdo de uma receita {@code SERIES}: séries no formato 7.1, sem uids (eles nascem no app ao aplicar). */
public record ReceitaSeries(@NotNull @Size(min = 1, max = 30) List<@Valid @NotNull Serie> series) {
}
