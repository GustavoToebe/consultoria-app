package br.com.treinos.api.tags;

import java.util.UUID;

/** Projeção da consulta em lote das tags dos alunos ({@link AlunoTagRepository#linhasDosAlunos}). O nome é dado pessoal em potencial: sem {@code toString}. */
public record TagDoAlunoLinha(UUID alunoId, UUID tagId, String nome, CorDeTag cor) {

    @Override
    public String toString() {
        return "TagDoAlunoLinha[...]";
    }
}
