import type { FaixaDeLargura } from '../tema/tokens';
import { VAO_DA_PRINCIPAL } from './arranjoPrincipalComApoio';

/**
 * Medidas da revisão da atualização pelo treinador (bloco D, 2.2 de `docs/planos/orientacoes-de-design-26-11.md`). A faixa é
 * a da `Tela` (a área ao lado do menu); quem decide lado a lado ou empilhado continua sendo `arranjoPrincipalComApoio` (952).
 */

/** Perguntas e respostas são lista sequencial (0.3): a principal não passa disto; a sobra vira margem, nunca esticamento. */
export const PRINCIPAL_MAXIMA_DA_REVISAO = 880;

/**
 * Apoio de 360 até a `normal`, 400 na `larga` e 440 na `ultralarga`. Passado à peça porque ela mediria a própria área, que
 * fica presa ao teto da composição e nunca chegaria aos 1600 da `larga`.
 * shortcut: as três colunas da `ultralarga` (Respostas · Prescrito · Feedback) são proposta ainda não confirmada pelo Gustavo;
 * enquanto isso, o apoio de 440 com o feedback em cima.
 */
export function apoioDaRevisao(faixa: FaixaDeLargura): number {
  if (faixa === 'ultralarga') return 440;
  return faixa === 'larga' ? 400 : 360;
}

/** Teto da composição inteira (cabeçalho junto, para alinhar): principal de 880 + vão + apoio. 1272, 1312 ou 1352. */
export const tetoDaRevisao = (faixa: FaixaDeLargura): number => PRINCIPAL_MAXIMA_DA_REVISAO + VAO_DA_PRINCIPAL + apoioDaRevisao(faixa);

export type AbaDaRevisao = 'respostas' | 'evolucao';

/** `?aba=evolucao` abre a Evolução, se a pessoa vê algum cartão dela; qualquer outro valor (ou sem a aba) abre as Respostas. */
export function abaDaRevisao(valor: string | string[] | undefined, temEvolucao: boolean): { ativa: AbaDaRevisao; abas: AbaDaRevisao[] } {
  const abas: AbaDaRevisao[] = temEvolucao ? ['respostas', 'evolucao'] : ['respostas'];
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return { ativa: temEvolucao && bruto === 'evolucao' ? 'evolucao' : 'respostas', abas };
}
