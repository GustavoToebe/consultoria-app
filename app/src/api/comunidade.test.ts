import {
  comentarComoAluno, criarPlaylist, excluirPlaylist, listarComentariosDaEquipe, listarComentariosDoAluno, listarPlaylists,
  listarPlaylistsDoAluno, moverAulasParaPlaylist, removerComentario, renomearPlaylist, reordenarAulasDaPlaylist, reordenarPlaylists,
} from './comunidade';
import { requisicao } from './cliente';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('rotas dos comentários', () => {
  it('as quatro listas pedem página e tamanho (30), como /atualizacoes/pagina', async () => {
    await expect(listarComentariosDoAluno({ tipo: 'post', id: 'p1' }, 0)).resolves.toBe('/aluno/comunidade/mural/p1/comentarios?pagina=0&tamanho=30');
    await expect(listarComentariosDoAluno({ tipo: 'aula', id: 'a1' }, 2)).resolves.toBe('/aluno/comunidade/aulas/a1/comentarios?pagina=2&tamanho=30');
    await expect(listarComentariosDaEquipe({ tipo: 'post', id: 'p1' }, 1)).resolves.toBe('/comunidade/mural/p1/comentarios?pagina=1&tamanho=30');
    await expect(listarComentariosDaEquipe({ tipo: 'aula', id: 'a1' }, 0)).resolves.toBe('/comunidade/aulas/a1/comentarios?pagina=0&tamanho=30');
  });

  it('comentar e remover vão à rota do alvo; o id é codificado', async () => {
    await comentarComoAluno({ tipo: 'aula', id: '../x' }, 'Oi');
    expect(requisicao).toHaveBeenLastCalledWith('/aluno/comunidade/aulas/..%2Fx/comentarios', { metodo: 'POST', corpo: { texto: 'Oi' } });
    await removerComentario('aula', 'c/1');
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/aulas/comentarios/c%2F1', { metodo: 'DELETE' });
    await removerComentario('post', 'c1');
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/mural/comentarios/c1', { metodo: 'DELETE' });
  });
});

describe('rotas das coleções', () => {
  it('ordem, ordem dos vídeos e lote levam a lista no corpo; o id da coleção é codificado', async () => {
    await reordenarPlaylists(['p2', 'p1']);
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/playlists/ordem', { metodo: 'PUT', corpo: { ids: ['p2', 'p1'] } });
    await reordenarAulasDaPlaylist('p/1', ['a2', 'a1']);
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/playlists/p%2F1/aulas/ordem', { metodo: 'PUT', corpo: { ids: ['a2', 'a1'] } });
    await moverAulasParaPlaylist(['a1'], null);
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/aulas/playlist', { metodo: 'PUT', corpo: { aulaIds: ['a1'], playlistId: null } });
  });

  it('criar, renomear, excluir e a lista do aluno', async () => {
    await criarPlaylist('Técnica');
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/playlists', { metodo: 'POST', corpo: { nome: 'Técnica' } });
    await renomearPlaylist('p1', 'Base');
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/playlists/p1', { metodo: 'PUT', corpo: { nome: 'Base' } });
    await excluirPlaylist('p1');
    expect(requisicao).toHaveBeenLastCalledWith('/comunidade/playlists/p1', { metodo: 'DELETE' });
    await expect(listarPlaylists()).resolves.toBe('/comunidade/playlists');
    await expect(listarPlaylistsDoAluno()).resolves.toBe('/aluno/comunidade/playlists');
  });
});
