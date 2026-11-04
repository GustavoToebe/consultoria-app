import { LARGURA_DUAS_COLUNAS, LARGURA_EDITOR, LARGURA_EDITOR_DUAS_COLUNAS } from '../tema/tokens';

/** O editor de treino usa lista + inspetor quando a largura de conteúdo medida chega a `LARGURA_DUAS_COLUNAS`; sem medida (nulo, NaN, 0), uma coluna. */
export function duasColunas(larguraMedida: number | null | undefined): boolean {
  return typeof larguraMedida === 'number' && larguraMedida >= LARGURA_DUAS_COLUNAS;
}

/** Largura da tela do editor: a larga em duas colunas, a de sempre em uma. */
export function larguraDoEditor(duas: boolean): number {
  return duas ? LARGURA_EDITOR_DUAS_COLUNAS : LARGURA_EDITOR;
}
