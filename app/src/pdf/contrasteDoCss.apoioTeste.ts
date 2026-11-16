import { contraste } from '../tema/tokens';

/**
 * Apoio de teste (nunca importado pelo app): lê as regras de um CSS e os `style` do HTML dos PDFs e devolve os textos
 * coloridos que ficam abaixo de `minimo` (4,5:1 por padrão) contra o fundo da própria regra (ou o branco, quando a regra
 * não tem fundo em `#RRGGBB`). Cinza sem fundo próprio não conta (texto neutro fixo, como o `.suave`, não é da marca).
 */
const HEX = '#[0-9A-Fa-f]{6}';
const ehCinza = (cor: string) => /^#([0-9a-f]{2})\1\1$/i.test(cor);

function avaliar(descricao: string, declaracoes: string, minimo: number): string[] {
  const cor = new RegExp(`(?:^|[;\\s])color:\\s*(${HEX})`, 'i').exec(declaracoes)?.[1];
  if (!cor) return [];
  const fundo = new RegExp(`(?:^|[;\\s])background:\\s*(${HEX})`, 'i').exec(declaracoes)?.[1];
  if (!fundo && ehCinza(cor)) return [];
  const razao = contraste(cor, fundo ?? '#FFFFFF');
  return razao < minimo ? [`${descricao}: ${cor} sobre ${fundo ?? '#FFFFFF'} = ${razao.toFixed(2)}`] : [];
}

export function textosSemContraste(css: string, corpo = '', minimo = 4.5): string[] {
  const deRegras = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap((m) => avaliar(m[1].trim(), m[2], minimo));
  const deAtributos = [...corpo.matchAll(/style="([^"]*)"/g)].flatMap((m) => avaliar(`style="${m[1]}"`, m[1], minimo));
  return [...deRegras, ...deAtributos];
}

/** O que identifica cada tema no CSS do documento (a regra que mais o distingue). */
export const MARCADOR_DO_TEMA = {
  CLASSICO: (cor: string) => new RegExp(String.raw`\.doc th \{[^}]*background: ${cor};`),
  MINIMALISTA: () => /\.doc th \{ background: transparent;/,
  MARCANTE: (cor: string) => new RegExp(String.raw`\.doc \.topo \{ background: ${cor};`),
} as const;
