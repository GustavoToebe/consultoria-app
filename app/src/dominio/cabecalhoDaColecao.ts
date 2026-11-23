import type { AulaDaComunidade, PlaylistDaComunidade } from '../api/comunidadeTipos';
import { type GrupoDePlaylist, resumoDosAuloes, SEM_COLECAO } from './comunidade';

/**
 * "Coleção N" de cada coleção (cabeçalho de coleção, 23/11): a posição na lista INTEIRA de coleções que o aluno vê, na ordem
 * dele, então o N do treinador é o mesmo do aluno (Gustavo, 23/11). O treinador passa `colecoesQueOAlunoVe(playlistsEmOrdem,
 * todas)`; o aluno, os grupos com vídeo (`agruparPorPlaylist` sem a busca). Filtro e busca não renumeram: a coleção 3
 * continua "Coleção 3". Coleção fora do mapa (a vazia no treinador) fica só "Coleção", sem número (`textosDoCabecalho`).
 */
export const numerosDasColecoes = (emOrdem: readonly Pick<PlaylistDaComunidade, 'id'>[]): Map<string, number> =>
  new Map(emOrdem.map((p, i) => [p.id, i + 1]));

/**
 * As coleções que o aluno vê, na ordem recebida: as com ao menos um vídeo publicado (a mesma regra que esconde a coleção
 * dele, D16: a API do aluno só manda vídeo publicado e `agruparPorPlaylist` tira a coleção sem vídeo). `aulas` é a lista
 * INTEIRA da equipe, não a filtrada.
 */
export const colecoesQueOAlunoVe = <P extends Pick<PlaylistDaComunidade, 'id'>>(emOrdem: readonly P[],
  aulas: readonly Pick<AulaDaComunidade, 'playlistId' | 'publicada'>[]): P[] =>
  emOrdem.filter((p) => aulas.some((a) => a.publicada && a.playlistId === p.id));

export interface TextosDoCabecalho {
  /** "Coleção 1", "Coleção" (sem número) ou "Sem coleção" (a tela põe em caixa alta pelo estilo, o texto fica em caixa normal para o leitor de tela). */
  sobretitulo: string;
  /** Nome da coleção; nulo em "Sem coleção", que não tem nome abaixo do sobretítulo. */
  nome: string | null;
  total: number;
  /** "Coleção 1: Treinos, 1 vídeo", "Coleção: Novidades, 0 vídeos" ou "Sem coleção, 2 vídeos". */
  nomeAcessivel: string;
}

/**
 * Os textos do cabeçalho de um grupo. Coleção sem número no mapa (a que o aluno não vê, no treinador) fica só "Coleção":
 * sobretítulo "COLEÇÃO" e nome acessível "Coleção: Novidades, 0 vídeos".
 */
export function textosDoCabecalho(g: Pick<GrupoDePlaylist<unknown>, 'playlist' | 'itens'>, numeros: ReadonlyMap<string, number>): TextosDoCabecalho {
  const total = g.itens.length;
  const resumo = resumoDosAuloes(total);
  if (!g.playlist) return { sobretitulo: SEM_COLECAO, nome: null, total, nomeAcessivel: `${SEM_COLECAO}, ${resumo}` };
  const n = numeros.get(g.playlist.id);
  const sobretitulo = n === undefined ? 'Coleção' : `Coleção ${n}`;
  return { sobretitulo, nome: g.playlist.nome, total, nomeAcessivel: `${sobretitulo}: ${g.playlist.nome}, ${resumo}` };
}
