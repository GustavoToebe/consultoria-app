import type { PlaylistDaComunidade } from '../api/comunidadeTipos';
import { LARGURA_FAIXA_LARGA, LARGURA_FAIXA_NORMAL } from '../tema/tokens';
import { playlistsEmOrdem, SEM_COLECAO } from './comunidade';

/**
 * Aba Vídeos do treinador em grade (D2, 19/11). A largura é a da área de conteúdo ao lado do menu (a mesma que a `Tela`
 * mede para a faixa, com o recuo lateral dentro), nunca a da janela.
 */

/** Abaixo disto a área é de celular (ou janela estreita): uma coluna. D2 não fixou o valor; 600 px é a classe compacta. */
export const LARGURA_DOIS_VIDEOS = 600;

/** 4 por linha a partir de 1600 px de área, 3 de 1024 a 1600, 2 abaixo e 1 no celular (régua `faixaDeLargura`). */
export function colunasDosVideos(area: number): 1 | 2 | 3 | 4 {
  if (area >= LARGURA_FAIXA_LARGA) return 4;
  if (area >= LARGURA_FAIXA_NORMAL) return 3;
  if (area >= LARGURA_DOIS_VIDEOS) return 2;
  return 1;
}

const comparavel = (texto: string): string => texto.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

/** A descrição do cartão, ou `null` quando é vazia ou só repete o título (sem diferença de caixa e espaços). */
export function descricaoDoCartao(titulo: string, descricao: string | null | undefined): string | null {
  const d = descricao?.trim();
  if (!d) return null;
  return comparavel(d) === comparavel(titulo) ? null : d;
}

/** Destinos do "Mover para outra coleção": as outras coleções, na ordem do treinador, e "Sem coleção" se o vídeo tem uma. */
export function destinosDoVideo(playlistId: string | null, colecoes: readonly PlaylistDaComunidade[]): { id: string | null; rotulo: string }[] {
  const outras = playlistsEmOrdem(colecoes).filter((p) => p.id !== playlistId).map((p) => ({ id: p.id as string | null, rotulo: p.nome }));
  return playlistId ? [...outras, { id: null, rotulo: SEM_COLECAO }] : outras;
}
