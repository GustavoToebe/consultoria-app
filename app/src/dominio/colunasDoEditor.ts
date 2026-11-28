import { LARGURA_DUAS_COLUNAS, LARGURA_EDITOR, LARGURA_EDITOR_DE_CAMPOS, LARGURA_EDITOR_DUAS_COLUNAS, type FaixaDeLargura } from '../tema/tokens';
import type { LarguraConteudo } from './preferencias';

/** Editores "índice + editor + prévia" (questionário, mobilidade; Gustavo, 28/11): o vão entre as colunas é fixo. */
export const VAO_ENTRE_COLUNAS = 24;
/** Índice (seções do questionário): largura fixa. */
export const LARGURA_DO_INDICE_DO_EDITOR = 260;
export const PREVIA_MINIMA = 440;
export const PREVIA_MAXIMA = 720;

export interface ColunasComPrevia { indice: number; editor: number; previa: number; vao: number; sobra: number }

/**
 * Larguras (px) da linha índice | editor | prévia para a largura medida da linha. O espaço vai para as colunas, nunca para
 * os vãos (24, fixos): o editor cresce primeiro, até `LARGURA_EDITOR_DE_CAMPOS` (1400); depois a prévia, de 440 até 720; o
 * que ainda sobra (ultrawide) fica no fim da linha (`sobra`), com o conjunto alinhado à esquerda. `comPrevia` falso: só
 * índice + editor (a prévia é 0 e há um vão só). Arredonda para baixo e deixa a fração na sobra: o `onLayout` da web traz
 * fração, e um meio pixel a mais quebraria a linha. Quem decide se há prévia é cada tela (o limiar é dela).
 */
export function colunasComPrevia(largura: number, indice: number = LARGURA_DO_INDICE_DO_EDITOR, comPrevia = true): ColunasComPrevia {
  const vaos = (comPrevia ? 2 : 1) * VAO_ENTRE_COLUNAS;
  const livre = Math.max(0, Math.floor(largura) - indice - vaos);
  const minima = comPrevia ? Math.min(PREVIA_MINIMA, livre) : 0;
  const editor = Math.min(LARGURA_EDITOR_DE_CAMPOS, livre - minima);
  const previa = comPrevia ? Math.min(PREVIA_MAXIMA, livre - editor) : 0;
  return { indice, editor, previa, vao: VAO_ENTRE_COLUNAS, sobra: largura - indice - vaos - editor - previa };
}

/** Coluna da lista de exercícios do treino (antes 360, em `treino/ListaDeExercicios`). */
export const LARGURA_DA_LISTA_DO_TREINO = 300;
/** Coluna do resumo do treino (antes 380, em `EditorDeTreino`). */
export const LARGURA_DO_RESUMO_DO_TREINO = 320;

/**
 * Terceira coluna do editor, só com as duas já ligadas. `'larga'` (treino) vale a partir da faixa larga (1600 px de
 * conteúdo) e ignora a preferência de largura, também com "Limitada" (decisão de 27/11); `'ultralarga'` (dieta e
 * mobilidade) é a regra de antes: faixa ultralarga (2400 px) e só com a preferência Automática.
 */
export function tresColunas(
  faixa: FaixaDeLargura,
  desde: 'larga' | 'ultralarga',
  preferencia: LarguraConteudo,
  duas: boolean,
): boolean {
  if (!duas) return false;
  if (desde === 'larga') return faixa === 'larga' || faixa === 'ultralarga';
  return faixa === 'ultralarga' && preferencia === 'AUTOMATICA';
}

/** O editor de treino usa lista + inspetor quando a largura de conteúdo medida chega a `LARGURA_DUAS_COLUNAS`; sem medida (nulo, NaN, 0), uma coluna. */
export function duasColunas(larguraMedida: number | null | undefined): boolean {
  return typeof larguraMedida === 'number' && larguraMedida >= LARGURA_DUAS_COLUNAS;
}

/** Largura da tela do editor: a larga em duas colunas, a de sempre em uma. */
export function larguraDoEditor(duas: boolean): number {
  return duas ? LARGURA_EDITOR_DUAS_COLUNAS : LARGURA_EDITOR;
}
