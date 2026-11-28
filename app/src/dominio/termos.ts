import { dataParaTela } from './formatos';

/** Trecho de uma linha: o texto entre `**` vem em negrito. */
export interface Trecho {
  texto: string;
  negrito: boolean;
}

/** Bloco do texto do termo ou do aviso (o texto vem da API em Markdown simples: `## seção`, `- item`, parágrafos). */
export type BlocoDoTexto =
  | { tipo: 'secao'; trechos: Trecho[] }
  | { tipo: 'item'; trechos: Trecho[] }
  | { tipo: 'paragrafo'; trechos: Trecho[] };

/** Seção numerada do documento para o índice "Nesta página": `id` estável (a mesma ordem dos blocos) e o rótulo como no texto. */
export interface SecaoDoDocumento {
  id: string;
  rotulo: string;
}

export const textoDosTrechos = (trechos: Trecho[]): string => trechos.map((t) => t.texto).join('');

/** Id do bloco `secao` de número `n` (0, 1, ...) do documento: prefixado para o termo e o aviso não colidirem no aceite. */
export const idDaSecao = (documento: string, n: number): string => `${documento.toLowerCase()}-secao-${n + 1}`;

/** Os blocos do documento, com o `id` de cada seção (o destino do índice e o `id` que ele observa na web). */
export function blocosDoDocumento(documento: string, texto: string): (BlocoDoTexto & { id?: string })[] {
  let n = 0;
  return blocosDoTexto(texto).map((b) => (b.tipo === 'secao' ? { ...b, id: idDaSecao(documento, n++) } : b));
}

/** As seções (`## 1. O que é este aplicativo`, ...) do documento, na ordem, para o índice. */
export function secoesDoDocumento(documento: string, texto: string): SecaoDoDocumento[] {
  return blocosDoDocumento(documento, texto).flatMap((b) => (b.id ? [{ id: b.id, rotulo: textoDosTrechos(b.trechos) }] : []));
}

/**
 * Linha abaixo do título: "Versão de 26/10/2026 · aceita por você em 28/11/2026". `versao` é a data ISO da versão;
 * `aceitoEm`, o instante do aceite (a data é a de Brasília), ou nulo/ausente (ainda não aceitou: só a versão).
 */
export function linhaDaVersao(versao: string, aceitoEm: string | null | undefined): string {
  const v = `Versão de ${dataParaTela(versao)}`;
  const ms = aceitoEm ? Date.parse(aceitoEm) : Number.NaN;
  // Brasília é UTC-3 o ano todo (sem horário de verão desde 2019), como no `dataEmBrasilia` da agenda.
  return Number.isNaN(ms) ? v : `${v} · aceita por você em ${dataParaTela(new Date(ms - 3 * 3600 * 1000).toISOString().slice(0, 10))}`;
}

export function trechosDaLinha(linha: string): Trecho[] {
  return linha
    .split('**')
    .map((texto, i) => ({ texto, negrito: i % 2 === 1 }))
    .filter((t) => t.texto !== '');
}

/** Divide o texto em seções, itens de lista e parágrafos. Linha vazia separa parágrafos; linha seguida sem lista junta. */
export function blocosDoTexto(texto: string): BlocoDoTexto[] {
  const blocos: BlocoDoTexto[] = [];
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', trechos: trechosDaLinha(paragrafo.join(' ')) });
    paragrafo = [];
  };
  let itemAberto: string | null = null;
  const fecharItem = () => {
    if (itemAberto !== null) blocos.push({ tipo: 'item', trechos: trechosDaLinha(itemAberto) });
    itemAberto = null;
  };
  for (const bruta of texto.replace(/\r\n/g, '\n').split('\n')) {
    const linha = bruta.trim();
    if (linha && itemAberto !== null && /^\s/.test(bruta) && !linha.startsWith('- ')) {
      itemAberto = `${itemAberto} ${linha}`;
      continue;
    }
    if (linha) fecharItem();
    if (!linha) {
      fecharItem();
      fecharParagrafo();
    } else if (linha.startsWith('#')) {
      fecharParagrafo();
      blocos.push({ tipo: 'secao', trechos: trechosDaLinha(linha.replace(/^#+\s*/, '')) });
    } else if (linha.startsWith('- ')) {
      fecharParagrafo();
      itemAberto = linha.slice(2);
    } else {
      paragrafo.push(linha);
    }
  }
  fecharItem();
  fecharParagrafo();
  return blocos;
}
