import { semAcento } from '../dominio/telas';
import type { Guia, SecaoGuia } from './conteudo';

type Pergunta = Guia['perguntas'][number];

export interface ResultadoDaBusca {
  secoes: SecaoGuia[];
  perguntas: Pergunta[];
  /** Assuntos e perguntas achados (o que a tela anuncia). */
  total: number;
}

/** Palavras da busca, sem acento; vazio = sem busca. */
export const palavrasDaBusca = (termo: string): string[] => semAcento(termo).split(/\s+/).filter(Boolean);

const contemTodas = (texto: string, palavras: readonly string[]) => {
  const alvo = semAcento(texto);
  return palavras.every((p) => alvo.includes(p));
};

/**
 * Busca da Ajuda, sem acento e sem diferença de maiúsculas; todas as palavras precisam aparecer. Seção cujo nome casa
 * vem inteira; senão, só os assuntos que casam (título ou texto). "Perguntas frequentes" no nome traz todas as perguntas.
 * Sem palavras, devolve tudo. Os textos chegam já como a tela mostra (`textoDoItem`).
 */
export function buscarNaAjuda(secoes: readonly SecaoGuia[], perguntas: readonly Pergunta[], termo: string): ResultadoDaBusca {
  const palavras = palavrasDaBusca(termo);
  if (!palavras.length) return { secoes: [...secoes], perguntas: [...perguntas], total: secoes.reduce((n, s) => n + s.itens.length, 0) + perguntas.length };
  const achadas = secoes.flatMap((s) => {
    if (contemTodas(s.titulo, palavras)) return [s];
    const itens = s.itens.filter((i) => contemTodas(`${i.titulo} ${i.texto}`, palavras));
    return itens.length ? [{ ...s, itens }] : [];
  });
  const todasAsPerguntas = contemTodas('Perguntas frequentes', palavras);
  const achadasPerguntas = todasAsPerguntas ? [...perguntas] : perguntas.filter((p) => contemTodas(`${p.pergunta} ${p.resposta}`, palavras));
  return { secoes: achadas, perguntas: achadasPerguntas, total: achadas.reduce((n, s) => n + s.itens.length, 0) + achadasPerguntas.length };
}

/** "3 resultados", "1 resultado", "Nenhum resultado". */
export const textoDoResultado = (total: number) => (total === 0 ? 'Nenhum resultado' : total === 1 ? '1 resultado' : `${total} resultados`);
