/** Larguras (do próprio contêiner, não da janela) a partir das quais a grade passa a ter 2 e 3 colunas. */
export const LARGURA_DUAS_COLUNAS = 760;
export const LARGURA_TRES_COLUNAS = 1240;

/** Colunas de uma lista em grade pela largura medida: 1 abaixo de 760 px, 2 a partir de 760, 3 a partir de 1240. */
export function colunasPorLargura(largura: number): 1 | 2 | 3 {
  if (largura >= LARGURA_TRES_COLUNAS) return 3;
  if (largura >= LARGURA_DUAS_COLUNAS) return 2;
  return 1;
}
