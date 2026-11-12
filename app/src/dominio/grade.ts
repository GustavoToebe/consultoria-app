/** Larguras (do próprio contêiner, não da janela) a partir das quais a grade passa a ter 2 e 3 colunas. */
export const LARGURA_DUAS_COLUNAS = 760;
export const LARGURA_TRES_COLUNAS = 1240;

/** Colunas de uma lista em grade pela largura medida: 1 abaixo de 760 px, 2 a partir de 760, 3 a partir de 1240. */
export function colunasPorLargura(largura: number): 1 | 2 | 3 {
  if (largura >= LARGURA_TRES_COLUNAS) return 3;
  if (largura >= LARGURA_DUAS_COLUNAS) return 2;
  return 1;
}

/**
 * Colunas dos oito indicadores de Interessados (F14 de 12/11): 4 (duas linhas de quatro), 2 ou 1, nunca 3, que deixaria a
 * lacuna de um cartão na última linha. Os limiares crescem com o texto ampliado (`fatorTexto`): a grade perde colunas
 * antes de espremer os rótulos. 4 cabem a partir de ~880 px de contêiner (cartão de ~210 px, onde "Dias até o aceite
 * (mediana)" ainda cabe numa linha) e 2 a partir de ~480.
 */
export function colunasDosIndicadores(largura: number, fatorTexto = 1): 1 | 2 | 4 {
  if (largura >= Math.round(880 * fatorTexto)) return 4;
  if (largura >= Math.round(480 * fatorTexto)) return 2;
  return 1;
}

/** Duas colunas (análises lado a lado, glossário) quando cada uma tem ao menos `minimo` px; senão uma. */
export function duasColunasCom(minimo: number, vao: number): (largura: number) => 1 | 2 {
  return (largura) => (largura >= 2 * minimo + vao ? 2 : 1);
}
