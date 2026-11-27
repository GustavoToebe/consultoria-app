import { quantasColunasNaLista } from './listaEmColunas';

/**
 * Os exercícios do treino do dia na web larga (27/11, contêiner do treinador): a lista ao lado do resumo ganha colunas lidas
 * de cima para baixo quando a largura dela comporta (a mesma régua da `ListaEmColunas` do treinador, até 3), em vez de um
 * cartão esticado. Cada combinação (bi-set, circuito...) é uma peça só, que nunca se parte entre colunas.
 */

/** Coluna de exercícios não fica mais estreita que isto (nome, "Última carga" e "N/3 séries" numa linha só). */
export const COLUNA_MINIMA_DOS_EXERCICIOS = 520;

export const colunasDosExercicios = (larguraDaLista: number, vao: number) =>
  quantasColunasNaLista(larguraDaLista, COLUNA_MINIMA_DOS_EXERCICIOS, vao);

/**
 * Divide peças contíguas (na ordem) em até `colunas` colunas pelo peso de cada uma (o número de exercícios da peça), para
 * as colunas terminarem perto da mesma altura: cada coluna fecha quando a próxima peça a deixaria mais longe da média do que
 * já está. Nunca deixa coluna vazia; com menos peças que colunas, uma peça por coluna. Devolve os índices das peças.
 */
export function dividirPorPeso(pesos: readonly number[], colunas: number): number[][] {
  if (!pesos.length) return [];
  const quantas = Math.max(1, Math.min(Math.floor(colunas), pesos.length));
  const grupos: number[][] = [];
  let i = 0;
  let restante = pesos.reduce((s, p) => s + p, 0);
  for (let c = 0; c < quantas; c++) {
    const faltam = quantas - c;
    const alvo = restante / faltam;
    const coluna: number[] = [];
    let soma = 0;
    // A última coluna leva o resto; as outras deixam pelo menos uma peça para cada coluna seguinte.
    while (i < pesos.length && (faltam === 1 || pesos.length - i > faltam - 1)) {
      const p = pesos[i]!;
      if (coluna.length && Math.abs(soma + p - alvo) > Math.abs(soma - alvo)) break;
      coluna.push(i);
      soma += p;
      i++;
    }
    restante -= soma;
    grupos.push(coluna);
  }
  return grupos;
}
