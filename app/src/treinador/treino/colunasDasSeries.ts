/**
 * Largura máxima de cada coluna da tabela de séries do editor (`TabelaDeBlocos`), pelo conteúdo (26/11): na ultralarga o
 * inspetor não tem teto e as colunas esticavam com o `flexGrow` até ficarem desproporcionais. Com o teto, a sobra da linha
 * fica vazia antes do chevron. Os valores ficam acima do que cada coluna recebe até 1600 px (lá nada muda) e perto do que
 * recebiam no inspetor de 1400 px. Fora do `.tsx` para o e2e (`e2e/tela-larga.spec.ts`) medir com o mesmo número.
 */
export const LARGURA_MAXIMA_DAS_COLUNAS = {
  /** Selo do tipo e, embaixo, o nome por extenso e o que varia ("WS + Rest pause", "Varia entre as séries: carga"). */
  tipo: 360,
  /** "50% · 70% · 85% a 90% da WS", "60 kg · 62,5 kg · 65 kg", "Carga de trabalho". */
  carga: 320,
  /** "8 a 12", "5 × 5 (25)" do cluster, ou "6 a 8, 8 a 10" quando varia (quebra em duas linhas, como já quebrava até 1600). */
  reps: 140,
  /** "2 min", "1 min 30 s"; "● Falta o descanso" quebra em duas linhas. */
  descanso: 140,
} as const;

/**
 * Coluna Série, fixa (27/11): "Série 3" e, embaixo, "6 séries · cluster". Com os 72 de antes a técnica ia para outra linha.
 * Mesma constante no cabeçalho e na célula.
 */
export const LARGURA_DA_COLUNA_SERIE = 104;

export type ColunaDaSerie = keyof typeof LARGURA_MAXIMA_DAS_COLUNAS;

/**
 * Colunas da tabela além de Série (sempre a primeira) pelo modo do exercício: o exercício sem carga (unidade "nenhuma")
 * não tem a coluna Carga, que só mostraria "—" em todas as linhas. Na ordem do cabeçalho.
 */
export function colunasDasSeries({ semCarga = false }: { semCarga?: boolean } = {}): ColunaDaSerie[] {
  return semCarga ? ['tipo', 'reps', 'descanso'] : ['tipo', 'carga', 'reps', 'descanso'];
}
