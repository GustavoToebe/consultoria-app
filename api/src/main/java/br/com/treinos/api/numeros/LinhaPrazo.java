package br.com.treinos.api.numeros;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Datas de uma atualização, com a pasta a que pertence: é o que o relatório precisa para classificar no prazo ou atrasada.
 * {@code pastaId}, {@code alunoId} e {@code pastaFim} servem só para saber se a pasta era a vigente no prazo original
 * ({@link VigenciaNaData}); nunca vão para a resposta.
 */
public record LinhaPrazo(UUID pastaId, UUID alunoId, LocalDate pastaFim, LocalDate dataAtualizacao, LocalDate atrasoAte,
                         Instant enviadaEm) {
}
