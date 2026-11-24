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

/**
 * `topoSempre` (mural do aluno): abaixo de 1280 px o topo existe desde o início, com ou sem conteúdo (a faixa de altura
 * fixa que se preenche quando os números chegam), e o feed desenha na hora sem nada andar. Ao lado, só com conteúdo.
 */
export function arranjoDoMural(area: number | null, temLateral: boolean, topoSempre = false): ArranjoDoMural {
  if (area === null || !(area > 0)) return 'medindo';
  if (area >= AREA_PARA_A_LATERAL) return temLateral ? 'lado' : 'sem';
  return temLateral || topoSempre ? 'topo' : 'sem';
}

interface Fonte<T> { dados?: T; erro?: unknown }

/** A coluna ao lado (a partir de 1280 px) só nasce quando a posição ou alguma conquista chegou. */
export const existemNumeros = (ranking: Fonte<unknown>, conquistas: Fonte<readonly unknown[]>): boolean =>
  !!ranking.dados || !!conquistas.dados?.length;

export const TEXTO_SEM_NUMEROS = 'Treine para entrar no ranking';
export const TEXTO_NUMEROS_INDISPONIVEIS = 'Seus números indisponíveis agora';

export type EstadoDaFaixa = { carregando: true } | { carregando: false; texto: string };

/**
 * O que a faixa do topo diz (abaixo de 1280 px). Com dado, só o que existe ("2º de 12 · 4 conquistas", "4 conquistas",
 * "2º de 12"; a posição só conta com treino concluído). Sem dado: carregando enquanto alguma leitura não respondeu; a
 * leitura falhou ou não há rede, "Seus números indisponíveis agora" (nunca "treine" por falha); respondeu sem treino e
 * sem conquista, "Treine para entrar no ranking".
 */
export function faixaDosNumeros(
  ranking: Fonte<{ posicao: number; participantes: number; treinosConcluidos: number }>,
  conquistas: Fonte<readonly unknown[]>,
  conectado = true,
): EstadoDaFaixa {
  const comTreino = ranking.dados && ranking.dados.treinosConcluidos > 0 ? ranking.dados : undefined;
  const texto = textoDaFaixaDosNumeros(comTreino, conquistas.dados?.length ?? 0);
  if (texto) return { carregando: false, texto };
  const esperando = (f: Fonte<unknown>) => f.dados === undefined && f.erro === undefined;
  if (conectado && (esperando(ranking) || esperando(conquistas))) return { carregando: true };
  const falhou = !conectado || (!ranking.dados && ranking.erro !== undefined) || conquistas.erro !== undefined;
  return { carregando: false, texto: falhou ? TEXTO_NUMEROS_INDISPONIVEIS : TEXTO_SEM_NUMEROS };
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
