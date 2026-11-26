import { LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { LINHA_DAS_TRES_COLUNAS, LINHA_DO_TOTAL_ULTRALARGO } from './colunasDaDieta';

/** Prévia ao vivo ao lado do editor de mobilidade: ~440 px na faixa `larga`, ~560 na `ultralarga` (Gustavo, 26/11). */
export const LARGURA_DA_PREVIA_NA_LARGA = 440;
export const LARGURA_DA_PREVIA_NA_ULTRALARGA = 560;
/** Lista das seções: a de sempre (280) e o teto a que ela cresce depois que o editor chega ao máximo. */
export const LARGURA_DA_LISTA = 280;
export const LARGURA_MAXIMA_DA_LISTA = 320;
export const VAO_DAS_TRES_COLUNAS = 24;

export interface ColunasDaMobilidade { lista: number; editor: number; previa: number; vao: number }

/**
 * Editor de mobilidade em três colunas (lista das seções | editor da seção | prévia ao vivo), pela largura MEDIDA da linha
 * das colunas, a mesma régua do Total do dia da dieta (`colunasDaDieta`: 1600 e 2400 de área vistos de dentro do recuo).
 * `null` abaixo da `larga` (ou sem medida): as duas colunas de sempre, sem prévia. O editor cresce até
 * `LARGURA_EDITOR_DE_CAMPOS` e a lista até `LARGURA_MAXIMA_DA_LISTA`; o que sobra depois disso vira vão, dividido igualmente
 * entre os dois vãos (como o editor de questionário, `colunasDoEditor`), nunca uma faixa vazia só à direita.
 */
export function colunasDaMobilidade(linha: number | null | undefined): ColunasDaMobilidade | null {
  if (typeof linha !== 'number' || !(linha >= LINHA_DAS_TRES_COLUNAS)) return null;
  const previa = linha >= LINHA_DO_TOTAL_ULTRALARGO ? LARGURA_DA_PREVIA_NA_ULTRALARGA : LARGURA_DA_PREVIA_NA_LARGA;
  const livre = linha - previa - 2 * VAO_DAS_TRES_COLUNAS;
  const editor = Math.min(LARGURA_EDITOR_DE_CAMPOS, livre - LARGURA_DA_LISTA);
  const lista = Math.min(LARGURA_MAXIMA_DA_LISTA, livre - editor);
  return { lista, editor, previa, vao: VAO_DAS_TRES_COLUNAS + (livre - editor - lista) / 2 };
}

/**
 * A seção em edição (a do inspetor) e o alvo da prévia: a escolhida, se ainda existe; senão a primeira (a escolhida saiu,
 * o modelo foi trocado); `null` sem seções.
 */
export function secaoEmEdicao<S extends { uid: string }>(secoes: readonly S[], escolhidaUid: string | null): S | null {
  return secoes.find((s) => s.uid === escolhidaUid) ?? secoes[0] ?? null;
}
