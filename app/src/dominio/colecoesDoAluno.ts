import type { AulaDaComunidade, PlaylistDaComunidade } from '../api/comunidadeTipos';
import { agruparPorPlaylist, type GrupoDePlaylist, numerados } from './comunidade';

/** Chave do grupo na tela (seção que abre e fecha): o id da coleção, ou `''` para "Sem coleção". */
export const chaveDoGrupo = (g: GrupoDePlaylist<unknown>): string => g.playlist?.id ?? '';

/**
 * Número de cada vídeo na coleção dele: a posição na lista INTEIRA da coleção (1, 2, 3…), por isso calculado sem a busca
 * (buscar não renumera: o 3º vídeo continua "3."). "Sem coleção" não tem número: lá não há ordem do treinador.
 */
export function numerosNaColecao(aulas: readonly Pick<AulaDaComunidade, 'id' | 'playlistId' | 'ordem'>[], playlists: readonly PlaylistDaComunidade[]): Map<string, number> {
  return new Map(agruparPorPlaylist(aulas, playlists).flatMap((g) => (g.playlist ? numerados(g.itens).map(({ item, numero }) => [item.id, numero] as const) : [])));
}
