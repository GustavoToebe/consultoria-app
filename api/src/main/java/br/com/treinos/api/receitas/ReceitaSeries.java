package br.com.treinos.api.receitas;

import br.com.treinos.api.treino.ConteudoTreino.Serie;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Conteúdo de uma receita {@code SERIES}: séries no formato novo (tipo por código, carga, esforço, técnica). Os uids
 * nascem no app ao aplicar; a exceção é a receita cujo back off aponta uma série ({@code carga.referenciaUid}): nela
 * as séries trazem uid, e o app troca por uids novos e remapeia a referência ao aplicar.
 */
public record ReceitaSeries(@NotNull @Size(min = 1, max = 30) List<@Valid @NotNull Serie> series) {
}
