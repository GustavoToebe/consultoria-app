import type { ConquistaDoAluno } from '../api/comunidadeTipos';

/**
 * Arranjo do mural em tela larga (decisão 3 de `docs/planos/tela-larga-revisao-2.md`, 24/11), o mesmo no treinador e no
 * aluno: o feed numa coluna de leitura de ~720 px e, ao lado, uma coluna de apoio (treinador: "Fixados" e "Enquetes
 * abertas"; aluno: "Sua posição" e "Suas conquistas"), fixa ao rolar na web. A medida é a da própria área do mural (o
 * `onLayout` dele), nunca a da janela: o menu lateral e o teto da tela do aluno comem largura.
 */
export const LARGURA_DO_FEED = 720;
export const LARGURA_DA_LATERAL = 340;
/** 32 px entre o feed e a coluna (o dobro do vão de dentro dos cartões). */
export const VAO_DA_LATERAL = 32;
/** Área do mural a partir da qual a coluna vai para a direita; abaixo, ela fica no topo do feed. */
export const AREA_PARA_A_LATERAL = 1280;

/**
 * `medindo`: a área ainda não chegou (a coluna não nasce no topo para pular para o lado); `sem`: a coluna não tem o que
 * mostrar e não ocupa lugar nenhum (nem vão); `topo`: em cima do feed; `lado`: à direita do feed; `reservando`: abaixo de
 * 1280 px, enquanto não se sabe se há o que mostrar, o topo guarda o lugar e o feed espera (assim nenhuma publicação já
 * desenhada anda quando a resposta chega, com ou sem conteúdo).
 */
export type ArranjoDoMural = 'medindo' | 'sem' | 'reservando' | 'topo' | 'lado';

/** `temLateral` nulo: ainda não se sabe (as fontes da coluna estão carregando). Ao lado, a coluna só nasce com conteúdo. */
export function arranjoDoMural(area: number | null, temLateral: boolean | null): ArranjoDoMural {
  if (temLateral === false) return 'sem';
  if (area === null || !(area > 0)) return 'medindo';
  if (area >= AREA_PARA_A_LATERAL) return temLateral ? 'lado' : 'sem';
  return temLateral ? 'topo' : 'reservando';
}

interface Fonte<T> { dados?: T; erro?: unknown }

/**
 * O aluno tem números para o mural? Verdadeiro assim que a posição ou alguma conquista chega; falso quando as duas fontes
 * responderam (com dado vazio ou com erro) sem nada; nulo enquanto alguma ainda carrega e nenhuma trouxe nada.
 */
export function existemNumeros(ranking: Fonte<unknown>, conquistas: Fonte<readonly unknown[]>): boolean | null {
  if (ranking.dados || conquistas.dados?.length) return true;
  const respondeu = (f: Fonte<unknown>) => f.dados !== undefined || f.erro !== undefined;
  return respondeu(ranking) && respondeu(conquistas) ? false : null;
}

/** A faixa de uma linha do topo: "2º de 12 · 4 conquistas" (só o que existe). */
export function textoDaFaixaDosNumeros(ranking: { posicao: number; participantes: number } | undefined, conquistas: number): string {
  const partes = [
    ranking ? `${ranking.posicao}º de ${ranking.participantes}` : null,
    conquistas > 0 ? (conquistas === 1 ? '1 conquista' : `${conquistas} conquistas`) : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/** Conquistas que cabem na coluna do aluno; as demais ficam na aba Conquistas ("Ver todas as conquistas"). */
export const CONQUISTAS_NA_LATERAL = 3;

/** As mais recentes primeiro, até `limite`, e quantas ficaram de fora. */
export function conquistasRecentes(lista: readonly ConquistaDoAluno[], limite = CONQUISTAS_NA_LATERAL): { itens: ConquistaDoAluno[]; aMais: number } {
  const ordenadas = [...lista].sort((a, b) => Date.parse(b.conquistadaEm) - Date.parse(a.conquistadaEm));
  return { itens: ordenadas.slice(0, limite), aMais: Math.max(0, lista.length - limite) };
}
