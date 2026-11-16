/**
 * Temas dos PDFs (plano `docs/planos/documentos-pdf-motor.md`, D1 e D2): lista fechada. O CSS de cada tema vem só do
 * código (`pdf/html.ts`); a consultoria escolhe um id e nunca escreve CSS, classe nem cor livre.
 */
export type TemaPdf = 'CLASSICO' | 'MINIMALISTA' | 'MARCANTE';

export const TEMAS_PDF: readonly { id: TemaPdf; nome: string; descricao: string }[] = [
  { id: 'CLASSICO', nome: 'Clássico', descricao: 'Faixa da marca no alto e cabeçalhos de tabela preenchidos com a cor da marca.' },
  { id: 'MINIMALISTA', nome: 'Minimalista', descricao: 'Fundo limpo, divisórias finas na cor da marca e cabeçalhos de tabela leves.' },
  { id: 'MARCANTE', nome: 'Marcante', descricao: 'Topo destacado na cor da marca e blocos em cartões de borda suave.' },
];

/** Valor desconhecido, nulo ou ausente cai em `CLASSICO` (o que a API manda é conferido contra a lista, nunca confiado). */
export function temaValido(valor: unknown): TemaPdf {
  return TEMAS_PDF.find((t) => t.id === valor)?.id ?? 'CLASSICO';
}
