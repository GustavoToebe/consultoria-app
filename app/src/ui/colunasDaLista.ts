import { espaco } from '../tema/tokens';

/**
 * Colunas de uma `ListaDeLinhas` (a lista de alunos, D2 de `docs/planos/telas-do-aluno-visual.md`): no PC as células de
 * cada `LinhaDaLista` ficam alinhadas a um `CabecalhoDasColunas`; no celular a linha volta a ser empilhada. Sem CSS grid
 * no React Native, cada coluna é flex com peso (`flexBasis` 0) e largura mínima, e o cabeçalho repete a geometria da linha
 * (borda, recuo, caixa, seta e a ação ao lado) para as colunas caírem no mesmo lugar.
 */
export interface ColunaDaLista {
  chave: string;
  rotulo: string;
  /** Parte do espaço que sobra (o `fr` do protótipo). */
  peso: number;
  /** Largura mínima em px (o nome do aluno não encolhe abaixo disso). */
  minima?: number;
}

/** Borda da linha (a `LinhaDaLista` usa 1 px no item). */
export const BORDA_DA_LINHA = 1;
/** Recuo interno da linha e espaço entre as partes dela. */
export const RECUO_DA_LINHA = espaco(1.5);
/** Espaço entre as colunas. */
export const ESPACO_ENTRE_COLUNAS = espaco(1.5);
export const LARGURA_DA_SETA = 20;
export const LARGURA_DA_CAIXA = 24;
/** A ação ao lado do link: um `IconeBotao moldura` (40 px) e o recuo até a borda. */
export const LARGURA_AO_LADO = 40 + RECUO_DA_LINHA;

export function estiloDaColuna(c: ColunaDaLista) {
  return { flexGrow: c.peso, flexShrink: 1, flexBasis: 0, minWidth: c.minima ?? 0 } as const;
}

/**
 * Espaços fixos do cabeçalho, antes e depois das colunas, iguais aos da linha: no Selecionar a caixa fica à esquerda;
 * fora dele, a seta do link e, se houver, a ação ao lado ficam à direita.
 */
export function margensDoCabecalho({ marcar, aoLado }: { marcar?: boolean; aoLado?: boolean }): { antes: number; depois: number } {
  if (marcar) return { antes: LARGURA_DA_CAIXA + RECUO_DA_LINHA, depois: 0 };
  return { antes: 0, depois: RECUO_DA_LINHA + LARGURA_DA_SETA + (aoLado ? LARGURA_AO_LADO : 0) };
}
