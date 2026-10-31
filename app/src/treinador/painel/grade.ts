import type { BlocoDoPainelId } from '../../dominio/painelBlocos';

/** Largura mínima de uma coluna da grade do painel (protótipo: 220 + 16 de espaço). */
const COLUNA = 220;
const ESPACO = 16;

/** Quantas colunas cabem na largura medida do painel: de 1 (celular) a 4 (PC). */
export function colunasDaGrade(largura: number): number {
  if (!(largura > 0)) return 1;
  return Math.max(1, Math.min(4, Math.floor((largura + ESPACO) / (COLUNA + ESPACO))));
}

/** Quantas colunas o bloco pede: Agenda e Financeiro 2, as barras 3, o resto 1 (D9). */
export function larguraDoBloco(id: BlocoDoPainelId): number {
  return id === 'recebido' ? 3 : id === 'agenda' || id === 'financeiro' ? 2 : 1;
}

export interface CelulaDaGrade {
  id: BlocoDoPainelId;
  /** Colunas que o bloco ocupa (nunca mais que a grade). */
  colunas: number;
}

/**
 * Distribui os blocos em linhas, na ordem: o bloco que não cabe no resto da linha começa a próxima. Cada linha é
 * desenhada com `flex: colunas` nos filhos, então a sobra da linha se divide entre os blocos dela (como no protótipo) e
 * os blocos da mesma linha ficam com a mesma altura.
 */
export function linhasDaGrade(ids: readonly BlocoDoPainelId[], colunas: number): CelulaDaGrade[][] {
  const linhas: CelulaDaGrade[][] = [];
  let atual: CelulaDaGrade[] = [];
  let usadas = 0;
  for (const id of ids) {
    const n = Math.min(larguraDoBloco(id), colunas);
    if (usadas + n > colunas && atual.length) {
      linhas.push(atual);
      atual = [];
      usadas = 0;
    }
    atual.push({ id, colunas: n });
    usadas += n;
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}
