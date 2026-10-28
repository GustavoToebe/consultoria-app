import { requisicao } from './cliente';
import { alterarAvaliacaoFisica, avaliacoesFisicasDoAluno, excluirAvaliacaoFisica, minhasAvaliacoesFisicas, registrarAvaliacaoFisica } from './rotas';
import { medidasVazias } from '../dominio/avaliacaoFisica';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('rotas da avaliação física', () => {
  const corpo = { data: '2026-10-28', medidas: { ...medidasVazias(), cintura: 80 }, observacao: null };

  it('ids codificados e métodos certos', async () => {
    await expect(avaliacoesFisicasDoAluno('../x')).resolves.toBe('/alunos/..%2Fx/avaliacoes-fisicas');
    await registrarAvaliacaoFisica('a/b', corpo);
    expect(requisicao).toHaveBeenLastCalledWith('/alunos/a%2Fb/avaliacoes-fisicas', { metodo: 'POST', corpo });
    await alterarAvaliacaoFisica('../c', { ...corpo, versao: 2 });
    expect(requisicao).toHaveBeenLastCalledWith('/avaliacoes-fisicas/..%2Fc', { metodo: 'PUT', corpo: { ...corpo, versao: 2 } });
    await excluirAvaliacaoFisica('i', 3);
    expect(requisicao).toHaveBeenLastCalledWith('/avaliacoes-fisicas/i?versao=3', { metodo: 'DELETE' });
  });

  it('a do aluno não leva id: é sempre o da sessão', async () => {
    await expect(minhasAvaliacoesFisicas()).resolves.toBe('/aluno/avaliacoes-fisicas');
  });
});
