import { escalar } from '../../dominio/preferencias';

// Regra pura (sem React Native) da prescrição lado a lado; quem desenha é o EditorGrupo, com as caixas de CamposDaPrescricao.

/**
 * Largura mínima (px, no tamanho de texto padrão) de cada caixa da prescrição do grupo de séries: o chip mais largo dela
 * ("AMRAP (o máximo)", "Percentual da carga de trabalho (WS)", "Esforço não prescrito"; no Descanso, o campo) mais uma
 * folga de 30 (era o recuo da caixa, que saiu; ficou para o chip não encostar na coluna vizinha). Medidas no navegador em
 * 04/11; os chips continuam chips (a metodologia usa os mesmos).
 */
export const MINIMO_DA_CAIXA = { repeticoes: 190, carga: 310, esforco: 200, descanso: 190 } as const;
export type CaixaDaPrescricao = keyof typeof MINIMO_DA_CAIXA;
/** O espaço entre as caixas (`espaco(1.5)`). */
export const ESPACO_ENTRE_CAIXAS = 12;


/** As caixas em linhas de `colunas`, na ordem de leitura. */
export function linhasDaPrescricao<T>(caixas: readonly T[], colunas: number): T[][] {
  const linhas: T[][] = [];
  for (let i = 0; i < caixas.length; i += Math.max(1, colunas)) linhas.push(caixas.slice(i, i + Math.max(1, colunas)));
  return linhas;
}

/**
 * A base (px) de cada coluna: a maior caixa que cai nela, em qualquer linha. As linhas usam as mesmas bases, então
 * Esforço fica embaixo de Repetições e Descanso embaixo de Carga, alinhados como numa grade.
 */
export function basesDasColunas(caixas: readonly CaixaDaPrescricao[], colunas: number, fator = 1): number[] {
  const bases: number[] = [];
  for (const linha of linhasDaPrescricao(caixas, colunas)) linha.forEach((c, i) => { bases[i] = Math.max(bases[i] ?? 0, escalar(MINIMO_DA_CAIXA[c], fator)); });
  return bases;
}

/**
 * Quantas caixas da prescrição (na ordem Repetições, Carga, Esforço, Descanso; o Cluster não tem Repetições) cabem por
 * linha na largura do corpo do grupo de séries: no máximo duas (decisão A do Gustavo, 04/11: 2 + 2 no PC, também nas
 * telas bem largas, onde as quatro numa linha ficavam longe demais umas das outras), se as duas colunas da grade couberem;
 * senão uma por linha. Sem medida ainda (`null`), uma. `fator` = tamanho do texto da pessoa.
 */
export function colunasDaPrescricao(largura: number | null, caixas: readonly CaixaDaPrescricao[], fator = 1): number {
  if (largura === null || caixas.length <= 1) return 1;
  const [a, b] = basesDasColunas(caixas, 2, fator);
  return a + b + ESPACO_ENTRE_CAIXAS <= largura ? 2 : 1;
}
