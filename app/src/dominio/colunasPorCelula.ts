/**
 * Tela larga: revisão (24/11). Colunas de cartões pela largura medida, sem esticar: quantas células de pelo menos
 * `minimo` px cabem (com `vao` entre elas), de 1 a `maximo`. A sobra de uma linha incompleta fica vazia (as células
 * não crescem para preencher). Usada nos Perfis da Equipe e no hub de Configurações.
 */
export function colunasPorCelula(largura: number, minimo: number, vao: number, maximo = 4): number {
  if (largura <= 0 || minimo <= 0) return 1;
  return Math.max(1, Math.min(maximo, Math.floor((largura + vao) / (minimo + vao))));
}
