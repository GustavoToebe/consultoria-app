package br.com.treinos.api.biblioteca;

import java.time.Instant;
import java.util.UUID;

/** Que exercício tem imagem própria e desde quando; lida sem trazer os bytes. */
public record ExercicioImagemMarca(UUID exercicioId, Instant atualizadaEm) {
}
