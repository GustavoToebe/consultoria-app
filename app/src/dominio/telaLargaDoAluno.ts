import type { FaixaDeLargura } from '../tema/tokens';
import { colunasDaGradeDeIndicadores } from './gradeDeIndicadores';

/**
 * Tela larga do app do aluno na web (revisão de 24/11, `docs/planos/tela-larga-revisao-app-do-aluno.md`). As telas do aluno
 * têm teto próprio: duas faixas de ~552 px (1120) até a faixa `normal`; a partir da `larga` (área de conteúdo de 1600 px ou
 * mais, a régua de 4.10) ganham a terceira faixa (1688), e o espaço vira colunas, nunca cartão esticado. Não passa de três:
 * o app do aluno é de leitura, e em 3440 px a sobra fica nas laterais (menos de 1/4 de cada lado).
 */
export const FAIXA_DO_ALUNO = 552;
export const VAO_DAS_FAIXAS = 16;
/** Teto de hoje (duas faixas): celular, tablet e PC até a faixa `normal`. */
export const LARGURA_TELA_DO_ALUNO = 2 * FAIXA_DO_ALUNO + VAO_DAS_FAIXAS;

/** A faixa ganha a terceira coluna (`larga` e `ultralarga`). */
export const telaLargaDoAluno = (faixa: FaixaDeLargura) => faixa === 'larga' || faixa === 'ultralarga';

/** Teto do conteúdo da tela do aluno: 1120 até a faixa `normal`; 1688 (três faixas) na `larga` em diante, se a tela pede três. */
export function larguraDaTelaDoAluno(faixa: FaixaDeLargura, faixas: 2 | 3 = 3): number {
  const n = telaLargaDoAluno(faixa) ? faixas : 2;
  return n * FAIXA_DO_ALUNO + (n - 1) * VAO_DAS_FAIXAS;
}

/** Cartão de lista (divisão, exercício, refeição) não fica mais estreito que isto na grade larga. */
export const CELULA_MINIMA_DO_ALUNO = 360;

/**
 * Colunas de uma lista de cartões na tela larga do aluno, pela largura da própria grade: cabe numa linha só, as colunas são as
 * que cabem com a célula mínima (o cartão mantém o tamanho e a sobra fica no fim da linha, nunca cartão esticado); passou de
 * uma linha, colunas iguais sem cartão sozinho na última (`colunasDaGradeDeIndicadores`: 5 dão 3 + 2, nunca 4 + 1).
 */
export function colunasDaGradeDoAluno(largura: number, total: number, vao: number): number {
  if (!(largura > 0)) return 1;
  const cabem = Math.max(1, Math.floor((largura + vao) / (CELULA_MINIMA_DO_ALUNO + vao)));
  if (total <= cabem) return cabem;
  const iguais = colunasDaGradeDeIndicadores(largura, total, { minimo: CELULA_MINIMA_DO_ALUNO, vao });
  // Sem divisão que evite o cartão sozinho (5 em 2 colunas), fica com as que cabem: um cartão sozinho é melhor que esticado.
  return iguais > 1 ? iguais : cabem;
}

/**
 * Coluna lateral das telas de trabalho na tela larga (o resumo e as ações da sessão do dia, o total e a água da dieta): fixa,
 * à esquerda, com a lista em colunas ao lado. 400 deixa três colunas de cartão ao lado já em 1920 com o menu aberto.
 */
export const LARGURA_LATERAL_DO_ALUNO = 400;

/**
 * Faixas do Início na tela larga. A terceira coluna leva o nível e a vitrine, então só existe quando algo dela vai aparecer.
 * O nível aparece com o retorno ligado e internet (aberto já sem internet, some). A vitrine aparece quando tem itens. Sem
 * nenhum dos dois, o Início fica nas duas colunas de 1120 em vez de reservar uma coluna vazia.
 */
export function faixasDoInicio(o: { retornoHabilitado: boolean; online: boolean; itensNaVitrine: number }): 2 | 3 {
  return (o.retornoHabilitado && o.online) || o.itensNaVitrine > 0 ? 3 : 2;
}
