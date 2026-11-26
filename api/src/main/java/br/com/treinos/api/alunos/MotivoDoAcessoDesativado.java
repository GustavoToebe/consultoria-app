package br.com.treinos.api.alunos;

/**
 * Por que o acesso do aluno foi desativado (V100; ATRASO na V104). {@code MANUAL}: a equipe desativou, o login fica
 * bloqueado ({@code usuario.ativo = false}). {@code ATRASO}: pausa por atraso (Fase 2), o aluno entra mas só usa as rotas
 * liberadas do {@code AcessoPausadoInterceptor}; quitar tudo o que venceu limpa a pausa (nunca o MANUAL).
 */
public enum MotivoDoAcessoDesativado {
    MANUAL,
    ATRASO;

    /**
     * O motivo como a equipe o vê: sem {@code FINANCEIRO_LER}, {@code ATRASO} sai como {@code MANUAL} (o app mostra só
     * "Acesso desativado"), para não revelar a inadimplência. Nulo = acesso normal. Não vale para o {@code /eu} do aluno.
     */
    public static String paraEquipe(MotivoDoAcessoDesativado motivo) {
        if (motivo == null) {
            return null;
        }
        return motivo == ATRASO && !br.com.treinos.api.equipe.AcessoAtual.pode("FINANCEIRO_LER") ? MANUAL.name() : motivo.name();
    }
}
