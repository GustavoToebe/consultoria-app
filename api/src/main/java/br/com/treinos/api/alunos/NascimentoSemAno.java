package br.com.treinos.api.alunos;

import java.util.UUID;

/**
 * Linha da consulta de aniversariantes ({@link AlunoRepository#nascimentosSemAnoDoEscopo}): só dia e mês, o ano não sai do banco.
 * Nome e data de nascimento são dado pessoal: não vão a log nem a {@code toString}.
 */
public record NascimentoSemAno(UUID alunoId, String nome, Integer mes, Integer dia) {

    @Override
    public String toString() {
        return "NascimentoSemAno[...]";
    }
}
