import { GUIAS } from './conteudo';
import { problemasDosVideos, VIDEOS_DA_AJUDA, type VideosDaAjuda } from './videos';

describe('vídeos da Ajuda', () => {
  it('a fonte real é válida', () => {
    expect(problemasDosVideos(VIDEOS_DA_AJUDA, GUIAS)).toEqual([]);
  });

  it('aceita link https numa seção que existe', () => {
    const v: VideosDaAjuda = { treinador: { financeiro: [{ titulo: 'Cobranças', url: 'https://videos.exemplo.test/a', duracao: '3 min' }] }, aluno: {} };
    expect(problemasDosVideos(v, GUIAS)).toEqual([]);
  });

  it('recusa http, id que não existe, título vazio e link repetido', () => {
    const v: VideosDaAjuda = {
      treinador: {
        financeiro: [{ titulo: 'A', url: 'http://videos.exemplo.test/a' }, { titulo: ' ', url: 'https://videos.exemplo.test/b' }],
        inexistente: [{ titulo: 'C', url: 'https://videos.exemplo.test/c' }],
      },
      aluno: { treino: [{ titulo: 'D', url: 'https://videos.exemplo.test/b' }] },
    };
    expect(problemasDosVideos(v, GUIAS)).toEqual([
      'treinador/financeiro: link precisa ser https (A)',
      'treinador/financeiro: vídeo sem título',
      'treinador/inexistente: não é seção do guia',
      'aluno/treino: link repetido (D)',
    ]);
  });

  it('o id vale só no guia do próprio público', () => {
    const v: VideosDaAjuda = { treinador: {}, aluno: { financeiro: [{ titulo: 'E', url: 'https://videos.exemplo.test/e' }] } };
    expect(problemasDosVideos(v, GUIAS)).toEqual(['aluno/financeiro: não é seção do guia']);
  });
});
