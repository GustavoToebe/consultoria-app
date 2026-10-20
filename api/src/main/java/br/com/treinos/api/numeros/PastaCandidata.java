package br.com.treinos.api.numeros;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Pasta que pode ser a vigente de um aluno numa data passada: não arquivada, com {@code inicio} e {@code fim} e com treino
 * ou dieta publicado. Os ids servem só para o cálculo em {@link VigenciaNaData}; nunca vão para a resposta do relatório.
 */
public record PastaCandidata(UUID pastaId, UUID alunoId, LocalDate inicio, Instant criadoEm) {
}
