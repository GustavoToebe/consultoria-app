import type { FaixaDeLargura } from '../tema/tokens';

/**
 * Colunas do Histórico do aluno na web (27/11, pedido do Gustavo: "as três abas usando a largura: gráficos e listas em grade
 * por faixa"). Vale para os blocos de divisão e as semanas dos Registros, os cartões do Corpo e as linhas das Atualizações.
 * A faixa é a da `Tela` (a área ao lado do menu) e só põe o teto: 2 da `normal` (1280 e 1536 com o menu aberto) e da
 * `larga`, 3 na `ultralarga`; quem decide é a largura medida do próprio bloco, que só deixa passar as colunas que cabem com
 * `minimo`. Assim os Registros ao lado do Progresso (~580 a 840 px na normal) ficam em uma e o Corpo e as Atualizações, na
 * largura toda, abrem duas já em 1280 (antes, uma coluna esticada de ~1000 px). Com "Largura do conteúdo" Limitada a
 * ultralarga pode ficar com 2.
 */
export const TETO_DE_COLUNAS_DO_HISTORICO: Readonly<Record<FaixaDeLargura, number>> = { compacta: 1, normal: 2, larga: 2, ultralarga: 3 };

/**
 * Coluna mais estreita: a tabela de cargas (data, carga, reps, séries), o cartão do peso e a linha da atualização ainda cabem
 * sem quebrar (o celular mostra os mesmos cartões em ~360). 440 deixa duas colunas com folga em 1280 (~990 px de área).
 */
export const MINIMO_DA_COLUNA_DO_HISTORICO = 440;

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

/** Altura estimada de um bloco de divisão para a alvenaria: o cabeçalho e, por exercício, o título e as linhas da tabela. */
export const pesoDaDivisao = (d: { exercicios: readonly { linhas: readonly unknown[] }[] }): number =>
  2 + d.exercicios.reduce((soma, e) => soma + 2 + e.linhas.length, 0);

/** Altura estimada de uma semana ("Por dia"): o cabeçalho com os sete dias e, por dia, a data e os exercícios. */
export const pesoDaSemana = (s: { dias: readonly { sessoes: readonly { exercicios: readonly unknown[] }[] }[] }): number =>
  3 + s.dias.reduce((soma, d) => soma + 1 + d.sessoes.reduce((t, x) => t + 1 + x.exercicios.length, 0), 0);
