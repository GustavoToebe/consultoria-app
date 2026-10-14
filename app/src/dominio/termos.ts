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
  for (const bruta of texto.replace(/\r\n/g, '\n').split('\n')) {
    const linha = bruta.trim();
    if (!linha) {
      fecharParagrafo();
    } else if (linha.startsWith('#')) {
      fecharParagrafo();
      blocos.push({ tipo: 'secao', trechos: trechosDaLinha(linha.replace(/^#+\s*/, '')) });
    } else if (linha.startsWith('- ')) {
      fecharParagrafo();
      blocos.push({ tipo: 'item', trechos: trechosDaLinha(linha.slice(2)) });
    } else {
      paragrafo.push(linha);
    }
  }
  fecharParagrafo();
  return blocos;
}
