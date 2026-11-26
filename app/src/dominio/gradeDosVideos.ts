import type { PlaylistDaComunidade } from '../api/comunidadeTipos';
import { LARGURA_FAIXA_LARGA, LARGURA_FAIXA_NORMAL, LARGURA_FAIXA_ULTRALARGA } from '../tema/tokens';
import { playlistsEmOrdem, SEM_COLECAO } from './comunidade';
import { linhasDaGrade } from './gradeDeIndicadores';

/**
 * Aba Vídeos do treinador em grade (D2, 19/11). A largura é a da área de conteúdo ao lado do menu (a mesma que a `Tela`
 * mede para a faixa, com o recuo lateral dentro), nunca a da janela.
 */

/** Abaixo disto a área é de celular (ou janela estreita): uma coluna. D2 não fixou o valor; 600 px é a classe compacta. */
export const LARGURA_DOIS_VIDEOS = 600;

/**
 * A partir daqui a faixa larga ganha a 5ª coluna (tela larga: revisão, 24/11): o cartão fica entre ~400 e ~520 px, como
 * em 1920, e não cresce até 760 px no monitor grande. 2560 com o menu aberto deixa ~2320 px de área.
 */
export const LARGURA_CINCO_VIDEOS = 2000;

/**
 * 6 por linha a partir de 2400 px de área (`ultralarga`), 5 de 2000 a 2400, 4 de 1600 a 2000, 3 de 1024 a 1600, 2 abaixo e
 * 1 no celular (régua `faixaDeLargura`).
 */
export function colunasDosVideos(area: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (area >= LARGURA_FAIXA_ULTRALARGA) return 6;
  if (area >= LARGURA_CINCO_VIDEOS) return 5;
  if (area >= LARGURA_FAIXA_LARGA) return 4;
  if (area >= LARGURA_FAIXA_NORMAL) return 3;
  if (area >= LARGURA_DOIS_VIDEOS) return 2;
  return 1;
}

/**
 * Vagas da grade de vídeos do aluno (`aluno/ColecoesDeAuloes`), sem cartão sozinho na última linha (26/11): as colunas são as
 * da régua (`colunasDosVideos`, o cartão nunca fica mais estreito nem esticado) e os cartões vão em linhas equilibradas
 * (`linhasDaGrade`: 7 em 3 = 3 + 2 + 2; 5 em 3 = 3 + 2; 8 em 3 = 3 + 3 + 2). A vaga que sobra numa linha (`null`) fica vazia à
 * direita e empurra o próximo cartão para a linha de baixo. Com poucos vídeos (cabem numa linha), uma linha só. O treinador
 * continua com a grade corrida de `colunasDosVideos`.
 */
export function vagasDosVideos(total: number, colunas: number): (number | null)[] {
  const vagas: (number | null)[] = [];
  let proximo = 0;
  linhasDaGrade(total, colunas).forEach((cartoes, linha, todas) => {
    for (let i = 0; i < cartoes; i++) vagas.push(proximo++);
    if (linha < todas.length - 1) for (let i = cartoes; i < colunas; i++) vagas.push(null);
  });
  return vagas;
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
