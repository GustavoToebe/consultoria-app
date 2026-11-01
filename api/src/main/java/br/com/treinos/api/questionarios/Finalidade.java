package br.com.treinos.api.questionarios;

/**
 * Para que serve o questionário: o check-in de cada período ({@code ATUALIZACAO}), a anamnese atribuída ao aluno
 * ({@code ANAMNESE}) ou as perguntas do treinador na página pública "Quero ser aluno" ({@code INSCRICAO}, só o padrão é
 * usado). O padrão é um por finalidade; aluno e pasta só escolhem questionário de atualização.
 */
public enum Finalidade {
    ATUALIZACAO, ANAMNESE, INSCRICAO
}
