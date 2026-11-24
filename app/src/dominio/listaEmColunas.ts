/**
 * Lista de linhas em colunas na tela larga (revisão de 24/11, `docs/planos/tela-larga-revisao-biblioteca-planejamento.md`):
 * o espaço extra vira coluna, nunca linha esticada (4.10 do `docs/design-e-front.md`). As colunas saem da largura medida da
 * própria lista (não da janela nem da faixa), então em 1280 e no celular a lista continua em uma coluna.
 */

/** Teto de colunas: com quatro, a linha da Biblioteca ficaria estreita demais para nome, metadados e ação. */
export const TETO_DE_COLUNAS = 3;

/** Quantas colunas cabem na lista com pelo menos `minimo` px cada e `vao` px entre elas (1 a `TETO_DE_COLUNAS`). */
export function quantasColunasNaLista(largura: number, minimo: number, vao: number): number {
  if (!(largura > 0)) return 1;
  return Math.max(1, Math.min(TETO_DE_COLUNAS, Math.floor((largura + vao) / (minimo + vao))));
}

/**
 * Divide os itens em colunas lidas de cima para baixo (a coluna 1 inteira, depois a 2), na mesma ordem da lista: a ordem
 * de leitura e a do Tab continuam as de uma coluna só. As colunas ficam equilibradas (a diferença entre elas é de no máximo
 * um item, as maiores primeiro) e nenhuma fica vazia: com menos itens que colunas, cada item numa coluna e as vagas que
 * sobram ficam vazias à direita (quem desenha mantém a largura da coluna; a linha não estica).
 */
export function dividirEmColunas<T>(itens: readonly T[], colunas: number): T[][] {
  if (!itens.length) return [];
  const quantas = Math.max(1, Math.min(Math.floor(colunas), itens.length));
  const base = Math.floor(itens.length / quantas);
  const sobra = itens.length % quantas;
  const grupos: T[][] = [];
  let inicio = 0;
  for (let i = 0; i < quantas; i++) {
    const tamanho = base + (i < sobra ? 1 : 0);
    grupos.push(itens.slice(inicio, inicio + tamanho));
    inicio += tamanho;
  }
  return grupos;
}
