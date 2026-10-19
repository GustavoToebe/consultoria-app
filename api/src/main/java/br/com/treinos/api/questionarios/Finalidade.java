package br.com.treinos.api.questionarios;

/**
 * Para que serve o questionário: o check-in de cada período ({@code ATUALIZACAO}) ou a anamnese atribuída ao aluno
 * ({@code ANAMNESE}). O padrão é um por finalidade; aluno e pasta só escolhem questionário de atualização.
 */
public enum Finalidade {
    ATUALIZACAO, ANAMNESE
}
