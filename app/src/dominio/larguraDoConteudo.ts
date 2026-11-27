import { espaco, LARGURA_MAXIMA, type FaixaDeLargura } from '../tema/tokens';
import type { LarguraConteudo } from './preferencias';

/**
 * Resolve o `maxWidth` do conteúdo da `Tela` e do `TelaDoEditor`:
 * - Telas declaradas abaixo de `LARGURA_MAXIMA` (formulários curtos de 640, aluno com o contêiner do treinador, sem teto próprio desde 27/11 (`TelaDoAluno`), editor de 1 coluna 1040) mantêm
 *   seu teto próprio em qualquer preferência.
 * - Listas, painéis e editores em 2 colunas (`>= LARGURA_MAXIMA` ou sem limite explícito) ficam sem teto (`undefined`)
 *   quando a preferência é `AUTOMATICA`, e mantêm `LARGURA_MAXIMA` (1800 px) quando é `LIMITADA`.
 */
export function larguraMaximaDoConteudo(largura: number | undefined, modo: LarguraConteudo): number | undefined {
  if (largura !== undefined && largura < LARGURA_MAXIMA) return largura;
  return modo === 'LIMITADA' ? LARGURA_MAXIMA : undefined;
}

/**
 * Respiro lateral da `Tela`: sobe para `48 px` (`espaco(6)`) na faixa `ultralarga` (`>= 2400 px` de área útil),
 * preservando qualquer `folga` maior já pedida pela tela. Nas demais faixas mantém a `folga` original.
 */
export function respiroLateralDaTela(faixa: FaixaDeLargura, folga?: number): number | undefined {
  if (faixa === 'ultralarga') return Math.max(folga ?? espaco(2), espaco(6));
  return folga;
}
