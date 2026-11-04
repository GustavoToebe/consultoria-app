import { escalar } from '../../dominio/preferencias';

// Regra pura (sem React Native) da prescrição lado a lado; quem desenha é o EditorGrupo, com as caixas de CamposDaPrescricao.

/**
 * Largura mínima (px, no tamanho de texto padrão) de cada caixa da prescrição do grupo de séries: o chip mais largo dela
 * ("AMRAP (o máximo)", "Percentual da carga de trabalho (WS)", "Esforço não prescrito"; no Descanso, o campo) mais o
 * recuo e a borda da caixa (30). Medidas no navegador em 04/11; os chips continuam chips (a metodologia usa os mesmos).
 */
export const MINIMO_DA_CAIXA = { repeticoes: 190, carga: 310, esforco: 200, descanso: 190 } as const;
export type CaixaDaPrescricao = keyof typeof MINIMO_DA_CAIXA;
/** O espaço entre as caixas (`espaco(1.5)`). */
export const ESPACO_ENTRE_CAIXAS = 12;

function larguraMinima(caixas: readonly CaixaDaPrescricao[], fator: number): number {
  return caixas.reduce((t, c) => t + escalar(MINIMO_DA_CAIXA[c], fator), 0) + ESPACO_ENTRE_CAIXAS * (caixas.length - 1);
}

/** As caixas em linhas de `colunas`, na ordem de leitura. */
export function linhasDaPrescricao<T>(caixas: readonly T[], colunas: number): T[][] {
  const linhas: T[][] = [];
  for (let i = 0; i < caixas.length; i += Math.max(1, colunas)) linhas.push(caixas.slice(i, i + Math.max(1, colunas)));
  return linhas;
}

/**
 * Quantas caixas da prescrição (na ordem Repetições, Carga, Esforço, Descanso; o Cluster não tem Repetições) cabem por
 * linha na largura do corpo do grupo de séries: todas (numa linha só) quando a soma dos mínimos cabe; senão de duas em
 * duas, se cada par couber; senão uma por linha. Sem medida ainda (`null`), uma. `fator` = tamanho do texto da pessoa.
 */
export function colunasDaPrescricao(largura: number | null, caixas: readonly CaixaDaPrescricao[], fator = 1): number {
  if (largura === null || caixas.length <= 1) return 1;
  if (larguraMinima(caixas, fator) <= largura) return caixas.length;
  return linhasDaPrescricao(caixas, 2).every((par) => larguraMinima(par, fator) <= largura) ? 2 : 1;
}
