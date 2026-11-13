/**
 * Ids dos blocos do painel do Início e a preferência do "Editar". Fica à parte de `painelDoInicio.ts` para
 * `preferencias.ts` importar sem ciclo (`painelDoInicio` usa `agendaCalendario`, que usa `preferencias`).
 */

/** Ordem padrão do painel (a do protótipo). */
export const BLOCOS_DO_PAINEL = ['atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'financeiro', 'recebido', 'alunos'] as const;
export type BlocoDoPainelId = (typeof BLOCOS_DO_PAINEL)[number];

/** Tamanho do bloco = colunas da grade que ele ocupa: Pequeno 1, Médio 2, Grande 3 (D2 e D5 de `docs/planos/inicio-editavel.md`). */
export type TamanhoDoBloco = 1 | 2 | 3;
export const TAMANHOS_DO_BLOCO: readonly TamanhoDoBloco[] = [1, 2, 3];
export const ROTULOS_DOS_TAMANHOS: Record<TamanhoDoBloco, string> = { 1: 'Pequeno', 2: 'Médio', 3: 'Grande' };
export const ehTamanhoDoBloco = (valor: unknown): valor is TamanhoDoBloco => valor === 1 || valor === 2 || valor === 3;

/** Tamanho de fábrica (D9 do painel): Agenda e Financeiro 2, as barras 3, o resto 1. */
export const TAMANHO_PADRAO_DO_BLOCO: Record<BlocoDoPainelId, TamanhoDoBloco> = {
  atualizacoes: 1, interessados: 1, treinos: 1, pastas: 1, agenda: 2, financeiro: 2, recebido: 3, alunos: 1,
};

/**
 * Preferência do painel (guardada em `Preferencias.painelDoInicio`, só no aparelho): ordem de todos os blocos, os
 * escondidos, o Todos/Meus que a pessoa escolheu em cada bloco (`true` = Meus; ausente = o padrão do perfil) e o tamanho
 * escolhido (ausente = {@link TAMANHO_PADRAO_DO_BLOCO}). `tamanhos` é opcional: a preferência gravada antes dele vale igual.
 */
export interface PainelDoInicioPreferido {
  ordem: BlocoDoPainelId[];
  escondidos: BlocoDoPainelId[];
  meus: Partial<Record<BlocoDoPainelId, boolean>>;
  tamanhos?: Partial<Record<BlocoDoPainelId, TamanhoDoBloco>>;
}

export const PAINEL_DO_INICIO_PADRAO: PainelDoInicioPreferido = { ordem: [...BLOCOS_DO_PAINEL], escondidos: [], meus: {}, tamanhos: {} };

export const ehBlocoDoPainel = (valor: unknown): valor is BlocoDoPainelId =>
  typeof valor === 'string' && (BLOCOS_DO_PAINEL as readonly string[]).includes(valor);

/** Tamanho que vale para o bloco: o escolhido ou o de fábrica. */
export const tamanhoDoBloco = (id: BlocoDoPainelId, tamanhos?: PainelDoInicioPreferido['tamanhos']): TamanhoDoBloco =>
  tamanhos?.[id] ?? TAMANHO_PADRAO_DO_BLOCO[id];
