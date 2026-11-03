package br.com.treinos.api.numeros;

import java.util.UUID;

/** Um aluno ativo e quem responde por ele ({@code null} = ninguém). Só para o cálculo interno da tabela da equipe. */
public record ResponsavelDoAluno(UUID alunoId, UUID responsavelId) {
}
