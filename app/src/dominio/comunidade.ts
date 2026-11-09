import type { PostDoMural } from '../api/comunidadeTipos';

/** A única reação do app é a curtida; o resto das reações que a API aceita não aparece na tela. */
export const EMOJI_DA_CURTIDA = '❤️';

export const totalDeCurtidas = (post: Pick<PostDoMural, 'reacoes'>): number => post.reacoes[EMOJI_DA_CURTIDA] ?? 0;

export const curtidoPorMim = (post: Pick<PostDoMural, 'minhasReacoes'>): boolean => post.minhasReacoes.includes(EMOJI_DA_CURTIDA);

/** "3º de 12 participantes" (empate divide a posição, como na API). */
export function textoDaPosicao(posicao: number, participantes: number): string {
  return `${posicao}º de ${participantes} ${participantes === 1 ? 'participante' : 'participantes'}`;
}
