package br.com.treinos.api.numeros;

import java.time.Instant;
import java.time.LocalDate;

/** Datas de uma atualização, sem aluno nem resposta: é tudo que o relatório precisa para classificar no prazo ou atrasada. */
public record LinhaPrazo(LocalDate dataAtualizacao, LocalDate atrasoAte, Instant enviadaEm) {
}
