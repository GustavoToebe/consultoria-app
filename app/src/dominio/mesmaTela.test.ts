import { mesmaTela } from './mesmaTela';

describe('mesmaTela', () => {
  it('reconhece a própria ficha, com ou sem barra e com consulta', () => {
    expect(mesmaTela('/treinador/alunos/aluno-1', '/treinador/alunos/aluno-1')).toBe(true);
    expect(mesmaTela('/treinador/alunos/aluno-1/', '/treinador/alunos/aluno-1')).toBe(true);
    expect(mesmaTela('/treinador/alunos/aluno-1?aba=treino', '/treinador/alunos/aluno-1')).toBe(true);
  });

  it('outra ficha e a lista de alunos não são a mesma tela', () => {
    expect(mesmaTela('/treinador/alunos/aluno-1', '/treinador/alunos/aluno-2')).toBe(false);
    expect(mesmaTela('/treinador/alunos/aluno-1', '/treinador/alunos')).toBe(false);
  });

  it('resolve o href com parâmetros', () => {
    expect(mesmaTela('/treinador/alunos/aluno-1', { pathname: '/treinador/alunos/[id]', params: { id: 'aluno-1' } })).toBe(true);
    expect(mesmaTela('/treinador/alunos/aluno-1', { pathname: '/treinador/alunos/[id]', params: { id: 'aluno-2' } })).toBe(false);
  });
});
