/**
 * Ids dos blocos do painel do Início e a preferência do "Editar". Fica à parte de `painelDoInicio.ts` para
 * `preferencias.ts` importar sem ciclo (`painelDoInicio` usa `agendaCalendario`, que usa `preferencias`).
 */

/** Ordem padrão do painel (a do protótipo). */
export const BLOCOS_DO_PAINEL = ['atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'financeiro', 'recebido', 'alunos'] as const;
export type BlocoDoPainelId = (typeof BLOCOS_DO_PAINEL)[number];

/**
 * Preferência do painel (guardada em `Preferencias.painelDoInicio`): ordem de todos os blocos e os escondidos (do
 * "Editar") e o Todos/Meus que a pessoa escolheu em cada bloco (`true` = Meus; bloco ausente = o padrão do perfil).
 */
export interface PainelDoInicioPreferido {
  ordem: BlocoDoPainelId[];
  escondidos: BlocoDoPainelId[];
  meus: Partial<Record<BlocoDoPainelId, boolean>>;
}

export const PAINEL_DO_INICIO_PADRAO: PainelDoInicioPreferido = { ordem: [...BLOCOS_DO_PAINEL], escondidos: [], meus: {} };

export const ehBlocoDoPainel = (valor: unknown): valor is BlocoDoPainelId =>
  typeof valor === 'string' && (BLOCOS_DO_PAINEL as readonly string[]).includes(valor);
