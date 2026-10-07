package br.com.treinos.api.security;

import java.util.UUID;

/**
 * Quem está na requisição, montado a partir do banco pelo {@link JwtAuthenticationFilter}. {@code alunoId} só existe
 * para o papel ALUNO: rotas {@code /aluno/**} usam sempre este id, nunca um id vindo do cliente.
 */
public record UsuarioAutenticado(UUID usuarioId, UUID consultoriaId, String papel, UUID alunoId) {
}
