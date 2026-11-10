package br.com.treinos.api.alunos;

import java.util.UUID;

/** Linha da consulta em lote de apelidos da comunidade ({@link AlunoRepository#apelidosDosUsuarios}). */
public record ApelidoDoAutor(UUID usuarioId, String apelido) {

    @Override
    public String toString() {
        return "ApelidoDoAutor[...]";
    }
}
