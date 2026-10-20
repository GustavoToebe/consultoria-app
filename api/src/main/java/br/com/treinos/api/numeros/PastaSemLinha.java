package br.com.treinos.api.numeros;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Pasta com data de atualização e sem linha de {@code atualizacao} (ninguém enviou nem avisou atraso): só o {@code fim}
 * da pasta, que é o prazo, e as datas de situação do aluno para saber se ele estava ativo nesse prazo. Sem id nem nome.
 */
public record PastaSemLinha(LocalDate fim, Instant alunoCriadoEm, Instant alunoInativadoEm, Instant alunoAnonimizadoEm) {
}
