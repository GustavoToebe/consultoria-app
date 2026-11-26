package br.com.treinos.api.alunos;

/**
 * Por que o acesso do aluno foi desativado (V100; ATRASO na V104). {@code MANUAL}: a equipe desativou, o login fica
 * bloqueado ({@code usuario.ativo = false}). {@code ATRASO}: pausa por atraso (Fase 2), o aluno entra mas só usa as rotas
 * liberadas do {@code AcessoPausadoInterceptor}; quitar tudo o que venceu limpa a pausa (nunca o MANUAL).
 */
public enum MotivoDoAcessoDesativado {
    MANUAL,
    ATRASO
}
