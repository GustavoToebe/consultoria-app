/**
 * Divide as orientações do treinador (texto livre do treino) em seções pelos títulos "Título: texto", o formato que a
 * importação da planilha grava (`MontagemDaImportacao.textosLivres`: um bloco "Coluna: texto" por coluna, separados por
 * linha em branco; "FS: ...", "WS: ...", "Cardio: ...") e que o treinador também escreve à mão.
 *
 * Título = linha que começa com letra, tem até 40 caracteres e 5 palavras, não tem outro ":" e termina em ":" seguido de
 * espaço ou do fim da linha ("10:30" e "https://" não contam). O texto do título vai até o próximo título; o que vem
 * antes do primeiro é a introdução. Com menos de 2 títulos não há seção: o texto fica inteiro na introdução.
 */
export interface Orientacoes {
  introducao: string | null;
  secoes: { titulo: string; texto: string }[];
}

const TITULO = /^(\p{L}[^:]{0,39}):(?:\s+(.*))?$/u;
const MAXIMO_DE_PALAVRAS = 5;

export function secoesDasOrientacoes(texto: string | null | undefined): Orientacoes {
  const limpo = (texto ?? '').replace(/\r\n?/g, '\n').trim();
  if (!limpo) return { introducao: null, secoes: [] };
  const antes: string[] = [];
  const secoes: { titulo: string; linhas: string[] }[] = [];
  for (const linha of limpo.split('\n')) {
    const m = TITULO.exec(linha.trim());
    const titulo = m?.[1].trim();
    if (titulo && titulo.split(/\s+/).length <= MAXIMO_DE_PALAVRAS) {
      secoes.push({ titulo, linhas: m?.[2] ? [m[2]] : [] });
    } else (secoes.at(-1)?.linhas ?? antes).push(linha);
  }
  if (secoes.length < 2) return { introducao: limpo, secoes: [] };
  const juntar = (linhas: string[]) => linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { introducao: juntar(antes) || null, secoes: secoes.map((s) => ({ titulo: s.titulo, texto: juntar(s.linhas) })) };
}
