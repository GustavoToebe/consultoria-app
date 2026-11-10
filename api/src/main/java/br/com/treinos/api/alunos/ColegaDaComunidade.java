package br.com.treinos.api.alunos;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Linha da consulta dos colegas da comunidade ({@link AlunoRepository#colegasDaComunidade}): só o que a regra do perfil precisa.
 * A data de nascimento serve para decidir a reserva em memória e <b>nunca</b> sai daqui: não vai a DTO, log nem {@code toString}.
 */
public record ColegaDaComunidade(UUID alunoId, UUID usuarioId, String nome, String apelido, Boolean perfilReservado,
                                 LocalDate dataNascimento) {

    @Override
    public String toString() {
        return "ColegaDaComunidade[...]";
    }
}
