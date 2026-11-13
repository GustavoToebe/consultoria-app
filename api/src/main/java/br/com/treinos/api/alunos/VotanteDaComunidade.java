package br.com.treinos.api.alunos;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Linha da consulta dos votantes de enquete que são aluno ({@link AlunoRepository#votantesDaComunidade}): o que o nome e a regra
 * da foto precisam. A data de nascimento só decide a reserva em memória e <b>nunca</b> sai daqui: não vai a DTO, log nem
 * {@code toString}.
 */
public record VotanteDaComunidade(UUID alunoId, UUID usuarioId, String nome, String apelido, boolean ativo, Instant anonimizadoEm,
                                  Boolean perfilReservado, LocalDate dataNascimento) {

    @Override
    public String toString() {
        return "VotanteDaComunidade[...]";
    }
}
