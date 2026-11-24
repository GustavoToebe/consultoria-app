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
 * mostrar e não ocupa lugar nenhum (nem vão); `topo`: em cima do feed; `lado`: à direita do feed.
 */
export type ArranjoDoMural = 'medindo' | 'sem' | 'topo' | 'lado';

export function arranjoDoMural(area: number | null, temLateral: boolean): ArranjoDoMural {
  if (!temLateral) return 'sem';
  if (area === null || !(area > 0)) return 'medindo';
  return area >= AREA_PARA_A_LATERAL ? 'lado' : 'topo';
}

/** Conquistas que cabem na coluna do aluno; as demais ficam na aba Conquistas ("Ver todas as conquistas"). */
export const CONQUISTAS_NA_LATERAL = 3;

/** As mais recentes primeiro, até `limite`, e quantas ficaram de fora. */
export function conquistasRecentes(lista: readonly ConquistaDoAluno[], limite = CONQUISTAS_NA_LATERAL): { itens: ConquistaDoAluno[]; aMais: number } {
  const ordenadas = [...lista].sort((a, b) => Date.parse(b.conquistadaEm) - Date.parse(a.conquistadaEm));
  return { itens: ordenadas.slice(0, limite), aMais: Math.max(0, lista.length - limite) };
}
