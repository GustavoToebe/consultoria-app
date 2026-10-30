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

/**
 * Borda da linha (a `LinhaDaLista` usa 1 px no item). Na lista em colunas do PC a linha não tem caixa: a borda continua
 * com 1 px, transparente dos lados e em cima, e a de baixo é a divisória; assim o cabeçalho fica alinhado nos dois modos.
 */
export const BORDA_DA_LINHA = 1;
/** Recuo interno da linha e espaço entre as partes dela. */
export const RECUO_DA_LINHA = espaco(1.5);
/** Espaço entre as colunas. */
export const ESPACO_ENTRE_COLUNAS = espaco(1.5);
export const LARGURA_DA_SETA = 20;
export const LARGURA_DA_CAIXA = 24;
/** O botão ao lado do link: um `IconeBotao moldura` (o lápis de editar). */
export const LARGURA_DO_BOTAO_AO_LADO = 40;
/** O que a ação ao lado ocupa na linha: o botão e o espaço até a seta, que fica depois dele. */
export const LARGURA_AO_LADO = LARGURA_DO_BOTAO_AO_LADO + RECUO_DA_LINHA;
/**
 * Distância do botão ao lado até a borda direita da linha: o recuo do link, a seta e o espaço entre os dois. O botão fica
 * por cima do link (irmão dele, nunca dentro), no lugar que o link deixa vazio antes da seta.
 */
export const DIREITA_DO_BOTAO_AO_LADO = RECUO_DA_LINHA + LARGURA_DA_SETA + RECUO_DA_LINHA;

export function estiloDaColuna(c: ColunaDaLista) {
  return { flexGrow: c.peso, flexShrink: 1, flexBasis: 0, minWidth: c.minima ?? 0 } as const;
}

/**
 * Espaços fixos do cabeçalho, antes e depois das colunas, iguais aos da linha: no Selecionar a caixa fica à esquerda;
 * fora dele, a ação ao lado (se houver) e a seta do link, por último, ficam à direita.
 */
export function margensDoCabecalho({ marcar, aoLado }: { marcar?: boolean; aoLado?: boolean }): { antes: number; depois: number } {
  if (marcar) return { antes: LARGURA_DA_CAIXA + RECUO_DA_LINHA, depois: 0 };
  return { antes: 0, depois: RECUO_DA_LINHA + LARGURA_DA_SETA + (aoLado ? LARGURA_AO_LADO : 0) };
}
