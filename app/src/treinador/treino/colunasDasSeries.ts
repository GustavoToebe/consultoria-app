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
  /** "8 a 12", ou "6 a 8, 8 a 10" quando varia (quebra em duas linhas, como já quebrava até 1600). */
  reps: 140,
  /** "2 min", "1 min 30 s": curto. */
  descanso: 140,
} as const;
