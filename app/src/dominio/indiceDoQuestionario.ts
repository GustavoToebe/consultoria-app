import type { ConteudoQuestionario } from '../api/tipos';
import type { ProblemasAgrupados } from './editorQuestionario';

/**
 * Editor de questionário em tela larga (Gustavo, 24/11 e 25/11; `docs/design-e-front.md` 4.10, "editor com índice e prévia
 * ao vivo"). A medida é a da área do próprio editor (o `onLayout` dele, como o `MuralComLateral`), não a da janela:
 * - abaixo de 1000 px: só o editor, com as abas Editar e Prévia (`simples`);
 * - de 1000 a < 1440: índice das seções à esquerda + editor, abas como antes (`indice`);
 * - de 1440 em diante: índice, editor (até `LARGURA_EDITOR_DE_CAMPOS`) e a prévia ao vivo de 560 px encostada à direita;
 *   as abas somem (`tres`).
 * Só na web: no celular e no tablet nativo nada muda (lá não há `sticky` nem a rolagem até a seção).
 */
export type ArranjoDoEditor = 'simples' | 'indice' | 'tres';

export const LIMIAR_DO_INDICE = 1000;
export const LIMIAR_DAS_TRES_COLUNAS = 1440;

export function arranjoDoEditor(largura: number | null, web: boolean): ArranjoDoEditor {
  if (!web || largura === null) return 'simples';
  if (largura >= LIMIAR_DAS_TRES_COLUNAS) return 'tres';
  if (largura >= LIMIAR_DO_INDICE) return 'indice';
  return 'simples';
}

/** Contagem da seção: "Sem pergunta", "1 pergunta", "12 perguntas". */
export const quantasPerguntas = (n: number): string => (n === 0 ? 'Sem pergunta' : n === 1 ? '1 pergunta' : `${n} perguntas`);

export interface ItemDoIndice {
  /** `instrucoes` ou `secao:<n>` (posição da seção no conteúdo). */
  chave: string;
  titulo: string;
  /** Contagem de perguntas; nula nas Instruções. */
  resumo: string | null;
  erro: boolean;
}

export const CHAVE_DAS_INSTRUCOES = 'instrucoes';
export const chaveDaSecao = (n: number) => `secao:${n}`;
/** Id do bloco na página (web: `nativeID` vira `id`), destino da rolagem do índice e da leitura da seção visível. */
export const idDoBloco = (chave: string) => `questionario-${chave.replace(':', '-')}`;
/** Posição da seção na chave do índice; `null` nas Instruções. */
export const secaoDaChave = (chave: string): number | null => (chave.startsWith('secao:') ? Number(chave.slice(6)) : null);

/**
 * Itens do índice: "Instruções" e cada seção com quantas perguntas tem. A seção tem erro (selo) quando o último
 * publicar apontou o título dela ou alguma pergunta dela; as Instruções, quando apontou uma instrução.
 */
export function itensDoIndice(c: ConteudoQuestionario, problemas: ProblemasAgrupados): ItemDoIndice[] {
  return [
    { chave: CHAVE_DAS_INSTRUCOES, titulo: 'Instruções', resumo: null, erro: problemas.gerais.some((p) => p.caminho.startsWith('instrucoes')) },
    ...c.secoes.map((s, i) => ({
      chave: chaveDaSecao(i),
      titulo: s.titulo.trim() || `Seção ${i + 1}`,
      resumo: quantasPerguntas(s.perguntas.length),
      erro: problemas.porSecao.has(i) || s.perguntas.some((p) => problemas.porPergunta.has(p.id)),
    })),
  ];
}

/**
 * Qual item está à vista: o último cujo topo já passou da `linha` (a base da barra fixa, com folga). Antes do primeiro,
 * o primeiro. `noFim` (a rolagem chegou ao fim) dá o último: uma seção curta no fim nunca chegaria à linha.
 */
export function itemVisivel(topos: readonly number[], linha: number, noFim: boolean): number {
  if (!topos.length) return 0;
  if (noFim) return topos.length - 1;
  let atual = 0;
  topos.forEach((t, i) => { if (t <= linha) atual = i; });
  return atual;
}
