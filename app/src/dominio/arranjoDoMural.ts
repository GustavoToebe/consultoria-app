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

interface Fonte<T> { dados?: T; erro?: unknown }
interface Posicao { posicao: number; participantes: number; treinosConcluidos: number }

export const TEXTO_SEM_NUMEROS = 'Treine para entrar no ranking';
export const TEXTO_NUMEROS_INDISPONIVEIS = 'Seus números indisponíveis agora';

/**
 * `com`: há posição (com treino) ou conquista, e `texto` é a linha da faixa; `sem`: nenhum número, e `texto` é o convite
 * neutro ou o aviso de indisponível.
 */
export type EstadoDosNumeros<P> = { tipo: 'carregando' } | { tipo: 'com'; posicao: P | undefined; texto: string } | { tipo: 'sem'; texto: string };

/**
 * Os números do aluno no mural, a mesma regra na faixa do topo e na coluna ao lado. Com dado, só o que existe ("2º de 12 ·
 * 4 conquistas", "4 conquistas", "2º de 12"; a posição só conta com treino concluído, nunca "1º de 1" de quem não treinou).
 * Sem dado: carregando enquanto alguma leitura não respondeu; leitura com falha ou sem rede, "Seus números indisponíveis
 * agora" (nunca "treine" por falha); respondeu sem treino e sem conquista, "Treine para entrar no ranking".
 */
export function estadoDosNumeros<P extends Posicao>(ranking: Fonte<P>, conquistas: Fonte<readonly unknown[]>, conectado = true): EstadoDosNumeros<P> {
  const posicao = ranking.dados && ranking.dados.treinosConcluidos > 0 ? ranking.dados : undefined;
  const texto = textoDaFaixaDosNumeros(posicao, conquistas.dados?.length ?? 0);
  if (texto) return { tipo: 'com', posicao, texto };
  const esperando = (f: Fonte<unknown>) => f.dados === undefined && f.erro === undefined;
  if (conectado && (esperando(ranking) || esperando(conquistas))) return { tipo: 'carregando' };
  const falhou = !conectado || (!ranking.dados && ranking.erro !== undefined) || conquistas.erro !== undefined;
  return { tipo: 'sem', texto: falhou ? TEXTO_NUMEROS_INDISPONIVEIS : TEXTO_SEM_NUMEROS };
}

/** Altura da faixa no tamanho padrão do texto: o alvo de toque de 44 mais o respiro da borda. */
export const ALTURA_BASE_DA_FAIXA = 56;

/**
 * Altura reservada da faixa para a escala do texto (a do sistema vezes o "Tamanho do texto" do app), igual em todos os
 * estados: 56 × escala cabe as duas linhas do texto (2 × 21 × escala, mais 2 px de borda) com folga em qualquer escala.
 */
export const alturaDaFaixa = (escala: number): number => Math.round(ALTURA_BASE_DA_FAIXA * escala);

/**
 * "Ver conquistas" escrito ao lado do texto só quando a faixa é larga para a escala; senão fica só a seta (o nome
 * acessível continua dizendo "Ver conquistas"), para as frases sem número caberem em duas linhas.
 */
export const rotuloNaFaixa = (largura: number, escala: number): boolean => largura >= 340 * escala;

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
