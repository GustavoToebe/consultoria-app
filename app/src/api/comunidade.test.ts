import { comentarComoAluno, listarComentariosDaEquipe, listarComentariosDoAluno, removerComentario } from './comunidade';
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
