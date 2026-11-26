import { AREA_MINIMA_LADO_A_LADO } from './arranjoPrincipalComApoio';

/**
 * Arranjo do Início do aluno. No celular e no tablet, `linhasDoInicio` (24/11); da área de 952 em diante (a mesma em que a
 * `PrincipalComApoio` das outras telas do aluno abre lado a lado), `inicioLargoDoAluno` (26/11,
 * `docs/planos/aluno-web-layout.md` seção 1 e `orientacoes-de-design-26-11.md` 1.1): o que pede ação primeiro no topo e,
 * embaixo, linhas na largura toda.
 */

export type BlocoDoInicio = 'hoje' | 'dieta' | 'agua' | 'pendencias' | 'compromissos' | 'semana' | 'nivel' | 'vitrine' | 'mapa';
/** Um bloco ou "Sua semana" e "Seu nível" juntos (`semanaENivel`: lado a lado, da mesma altura). */
export type PecaDoInicio = BlocoDoInicio | 'semanaENivel';

/** Abaixo do arranjo largo: uma linha tem uma pilha (largura toda) ou duas (colunas iguais, independentes). */
export type LinhaDoInicio = PecaDoInicio[][];

/** Duas colunas no corpo do Início abaixo do arranjo largo (tablet): cabem duas de 360 com o vão. */
export const MINIMO_DA_COLUNA_DO_INICIO = 360;

/**
 * O Início abaixo do arranjo largo (24/11): o Hoje primeiro em qualquer largura, depois Dieta e Água, Sua semana e Seu nível
 * e o mapa do ano.
 * - Uma coluna (celular): Hoje › Dieta › Água › pendências › compromissos › semana › nível › mapa › vitrine.
 * - Duas colunas (tablet): Hoje e Dieta à esquerda, Água à direita, com pendências e compromissos embaixo de cada uma;
 *   depois semana e nível lado a lado e da mesma altura, e o mapa na largura toda.
 * - Sem o retorno (sem nível nem mapa) a semana vai para a pilha da Água, para não esticar sozinha na largura toda.
 */
export function linhasDoInicio(o: { retorno: boolean; duasColunas: boolean }): LinhaDoInicio[] {
  if (!o.duasColunas) return [[['hoje', 'dieta', 'agua', 'pendencias', 'compromissos', 'semana', 'nivel', 'mapa', 'vitrine']]];
  if (!o.retorno) return [[['hoje', 'dieta', 'pendencias'], ['agua', 'compromissos', 'semana', 'vitrine']]];
  return [[['hoje', 'dieta', 'pendencias'], ['agua', 'compromissos', 'vitrine']], [['semanaENivel']], [['mapa']]];
}

/** O arranjo largo vale da área de 952 em diante, a mesma em que a `PrincipalComApoio` abre lado a lado (apoio de 360). */
export const AREA_DO_INICIO_LARGO = AREA_MINIMA_LADO_A_LADO;
export const inicioLargo = (largura: number) => largura >= AREA_DO_INICIO_LARGO;

export interface InicioLargo {
  /** Coluna principal do topo: o Hoje, a Dieta logo embaixo e os compromissos presenciais (a agenda do dia). */
  principal: PecaDoInicio[];
  /** Coluna de apoio do topo, à direita: as pendências (o mais urgente, na altura do Hoje) e a Água de hoje. */
  apoio: PecaDoInicio[];
  /** Abaixo das duas, na largura toda, uma linha cada: semana e nível lado a lado, o mapa do ano e a vitrine por último. */
  linhas: PecaDoInicio[];
}

/**
 * O Início largo (26/11). O topo é a `PrincipalComApoio` das outras telas do aluno; embaixo, linhas na largura toda.
 * Conferido nas capturas: a linha "Dieta · Água" que a orientação 1.1 sugeria deixava ~170 px vazios sob a Dieta (uma
 * linha só de altura) ao lado da Água (botões de copo); com a Dieta sob o Hoje e a Água sob as pendências as duas colunas
 * terminam perto. Sem pendências a Água sobe sozinha para a altura do Hoje, e o Hoje não cresce (a coluna fica onde está).
 * Nenhum bloco troca de coluna conforme o que chega da API: nada remonta (as pendências e o nível leem a API ao montar).
 */
export function inicioLargoDoAluno(o: { retorno: boolean; vitrine: boolean }): InicioLargo {
  const linhas: PecaDoInicio[] = ['semanaENivel'];
  if (o.retorno) linhas.push('mapa');
  if (o.vitrine) linhas.push('vitrine');
  return { principal: ['hoje', 'dieta', 'compromissos'], apoio: ['pendencias', 'agua'], linhas };
}

/** Colunas da grade de produtos da vitrine larga: célula mínima de 240 e no máximo uma por item (dois itens dividem a linha, sem coluna vazia). */
export function colunasDaVitrineDoInicio(largura: number, itens: number, vao: number): number {
  return Math.max(1, Math.min(itens, Math.floor((largura + vao) / (240 + vao))));
}
