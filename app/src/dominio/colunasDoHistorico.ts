import type { FaixaDeLargura } from '../tema/tokens';

/**
 * Colunas do Histórico do aluno na web (27/11, pedido do Gustavo: "normal, larga e ultralarga com 1, 2 e 3 colunas
 * equilibradas, sem buraco"). Vale para os blocos de divisão e as semanas dos Registros, os cartões do Corpo e as linhas
 * das Atualizações. A faixa é a da `Tela` (a área ao lado do menu); a largura é a medida do próprio bloco, que só deixa
 * passar as colunas que cabem com `minimo` (com "Largura do conteúdo" Limitada, a ultralarga pode ficar com 2).
 */
export const TETO_DE_COLUNAS_DO_HISTORICO: Readonly<Record<FaixaDeLargura, number>> = { compacta: 1, normal: 1, larga: 2, ultralarga: 3 };

/** Coluna mais estreita: a tabela de cargas (data, carga, reps, séries) e a linha da atualização ainda cabem sem quebrar. */
export const MINIMO_DA_COLUNA_DO_HISTORICO = 480;

export function colunasDoHistorico(
  largura: number,
  faixa: FaixaDeLargura,
  { pecas = Number.POSITIVE_INFINITY, minimo = MINIMO_DA_COLUNA_DO_HISTORICO, vao = 24, maximo = 3 }: { pecas?: number; minimo?: number; vao?: number; maximo?: number } = {},
): number {
  if (!(largura > 0) || pecas < 2) return 1;
  const cabem = Math.floor((largura + vao) / (minimo + vao));
  // Bloco de cartões (`pecas`) não abre coluna vazia: com 2 divisões, 2 colunas. Lista de linhas passa sem `pecas`.
  return Math.max(1, Math.min(TETO_DE_COLUNAS_DO_HISTORICO[faixa], maximo, cabem, pecas));
}

/**
 * Corpo para em 2 colunas também na ultralarga: são só 3 cartões de alturas muito diferentes (peso com a lista, avaliação
 * com gráfico, fotos às vezes vazias) e em 3 colunas sobrava buraco embaixo dos curtos; 2 é o arranjo da Ficha › Evolução
 * do treinador, com os mesmos cartões (capturas de 27/11).
 */
export const MAXIMO_DE_COLUNAS_DO_CORPO = 2;

/** Altura estimada de um bloco de divisão para a alvenaria: o cabeçalho e, por exercício, o título e as linhas da tabela. */
export const pesoDaDivisao = (d: { exercicios: readonly { linhas: readonly unknown[] }[] }): number =>
  2 + d.exercicios.reduce((soma, e) => soma + 2 + e.linhas.length, 0);

/** Altura estimada de uma semana ("Por dia"): o cabeçalho com os sete dias e, por dia, a data e os exercícios. */
export const pesoDaSemana = (s: { dias: readonly { sessoes: readonly { exercicios: readonly unknown[] }[] }[] }): number =>
  3 + s.dias.reduce((soma, d) => soma + 1 + d.sessoes.reduce((t, x) => t + 1 + x.exercicios.length, 0), 0);
