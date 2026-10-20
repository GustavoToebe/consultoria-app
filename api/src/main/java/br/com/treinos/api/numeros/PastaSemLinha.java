package br.com.treinos.api.numeros;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Pasta com data de atualização e sem linha de {@code atualizacao} (ninguém enviou nem avisou atraso): o {@code fim} da
 * pasta, que é o prazo, e as datas de situação do aluno para saber se ele estava ativo nesse prazo. Os ids servem só para
 * perguntar a {@link VigenciaNaData} se a pasta era a vigente no prazo; nunca vão para a resposta.
 */
public record PastaSemLinha(UUID pastaId, UUID alunoId, LocalDate fim, Instant alunoCriadoEm, Instant alunoInativadoEm,
                            Instant alunoAnonimizadoEm) {
}
