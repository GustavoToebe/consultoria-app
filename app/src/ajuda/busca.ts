import { semAcento } from '../dominio/telas';
import { idDoTopico, semMarcacao } from './blocos';
import type { Guia, SecaoGuia } from './conteudo';

type Pergunta = Guia['perguntas'][number];

/** Id do artigo das perguntas frequentes (não colide com as seções do guia). */
export const PERGUNTAS = 'perguntas';

export interface TopicoDoArtigo {
  /** Âncora do tópico (`idDoTopico` do título), única no artigo. */
  id: string;
  titulo: string;
  /** Com a marcação de `blocos.ts`. */
  texto: string;
}

/** Um assunto da Ajuda como a tela o mostra: uma seção do guia, ou as perguntas frequentes (uma pergunta por tópico). */
export interface Artigo {
  id: string;
  titulo: string;
  topicos: TopicoDoArtigo[];
}

/** Os artigos na ordem do guia, com as perguntas frequentes por último (quando há). */
export function artigosDaAjuda(secoes: readonly SecaoGuia[], perguntas: readonly Pergunta[]): Artigo[] {
  const artigos: Artigo[] = secoes.map((s) => ({ id: s.id, titulo: s.titulo, topicos: s.itens.map((i) => ({ id: idDoTopico(i.titulo), titulo: i.titulo, texto: i.texto })) }));
  if (perguntas.length) {
    artigos.push({ id: PERGUNTAS, titulo: 'Perguntas frequentes', topicos: perguntas.map((p) => ({ id: idDoTopico(p.pergunta), titulo: p.pergunta, texto: p.resposta })) });
  }
  return artigos;
}

/** Palavras da busca, sem acento; vazio = sem busca. */
export const palavrasDaBusca = (termo: string): string[] => semAcento(termo).split(/\s+/).filter(Boolean);

/** O trecho do resultado, em três partes: a palavra achada (`achado`) fica em destaque entre o que vem antes e depois. */
export interface TrechoDoResultado {
  antes: string;
  achado: string;
  depois: string;
}

export interface ResultadoDaBusca {
  artigoId: string;
  artigoTitulo: string;
  topicoId: string;
  topicoTitulo: string;
  trecho: TrechoDoResultado;
}

/** Letra a letra sem acento e sem caixa: o índice no texto normalizado é o mesmo do original. */
const normalizar = (texto: string) => texto.split('').map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 1) || ' ').join('');

const ANTES = 60;
const DEPOIS = 140;

/**
 * Trecho do texto em volta da primeira palavra da busca que aparece nele, cortado em espaço e com "…" nas pontas que
 * foram cortadas. A palavra fica com a grafia original (acento, caixa). Sem a palavra no texto (ela só está no título),
 * o começo do texto, sem destaque.
 */
export function trechoDoResultado(texto: string, palavras: readonly string[]): TrechoDoResultado {
  const alvo = normalizar(texto);
  const achada = palavras.map((p) => ({ p, i: alvo.indexOf(p) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0];
  if (!achada) {
    const fim = texto.length > ANTES + DEPOIS ? texto.lastIndexOf(' ', ANTES + DEPOIS) : texto.length;
    return { antes: fim < texto.length ? `${texto.slice(0, fim)}…` : texto, achado: '', depois: '' };
  }
  const inicio = achada.i;
  const fim = inicio + achada.p.length;
  let de = Math.max(0, inicio - ANTES);
  if (de > 0) de = texto.indexOf(' ', de) + 1 || de;
  if (de > inicio) de = inicio;
  let ate = Math.min(texto.length, fim + DEPOIS);
  if (ate < texto.length) {
    const espaco = texto.lastIndexOf(' ', ate);
    ate = espaco > fim ? espaco : ate;
  }
  return {
    antes: `${de > 0 ? '…' : ''}${texto.slice(de, inicio)}`,
    achado: texto.slice(inicio, fim),
    depois: `${texto.slice(fim, ate)}${ate < texto.length ? '…' : ''}`,
  };
}

/**
 * Busca da Ajuda, sem acento e sem diferença de maiúsculas: um resultado por tópico em que todas as palavras aparecem
 * (no nome do assunto, no título do tópico ou no texto, sem a marcação). Primeiro os tópicos cujo título tem todas as
 * palavras, depois os do assunto que casa, depois os que casam só pelo texto; dentro de cada grupo, a ordem do guia. Os
 * textos chegam já como a tela mostra (`textoDoItem`). Sem palavras, nenhum resultado.
 */
export function buscarNaAjuda(artigos: readonly Artigo[], termo: string): ResultadoDaBusca[] {
  const palavras = palavrasDaBusca(termo);
  if (!palavras.length) return [];
  const todas = (texto: string) => {
    const alvo = semAcento(texto);
    return palavras.every((p) => alvo.includes(p));
  };
  const achados = artigos.flatMap((a) => a.topicos.map((t) => {
    const texto = semMarcacao(t.texto);
    const peso = todas(t.titulo) ? 0 : todas(a.titulo) ? 1 : todas(`${a.titulo} ${t.titulo} ${texto}`) ? 2 : null;
    return peso === null ? null : { peso, resultado: { artigoId: a.id, artigoTitulo: a.titulo, topicoId: t.id, topicoTitulo: t.titulo, trecho: trechoDoResultado(texto, palavras) } };
  })).filter((x) => x !== null);
  return achados.sort((x, y) => x.peso - y.peso).map((x) => x.resultado);
}

/** "3 resultados", "1 resultado", "Nenhum resultado". */
export const textoDoResultado = (total: number) => (total === 0 ? 'Nenhum resultado' : total === 1 ? '1 resultado' : `${total} resultados`);
