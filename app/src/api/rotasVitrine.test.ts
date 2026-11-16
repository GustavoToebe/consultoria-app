import { requisicao } from './cliente';
import {
  alterarItemDaVitrine, baixarFotoDoItem, baixarFotoDoItemDoAluno, criarItemDaVitrine, excluirItemDaVitrine, itensDaVitrine, ordenarItensDaVitrine,
  removerFotoDoItem, trocarFotoDoItem, vitrineDoAluno,
} from './rotas';
import { corpoDoItem, rascunhoVazio } from '../dominio/vitrine';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('rotas da vitrine', () => {
  const corpo = corpoDoItem({ ...rascunhoVazio(), nome: 'Fullbody' });

  it('equipe: ids codificados e métodos certos', async () => {
    await expect(itensDaVitrine()).resolves.toBe('/vitrine/itens');
    await criarItemDaVitrine(corpo);
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens', { metodo: 'POST', corpo });
    await alterarItemDaVitrine('../x', { ...corpo, versao: 2 });
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens/..%2Fx', { metodo: 'PUT', corpo: { ...corpo, versao: 2 } });
    await excluirItemDaVitrine('i', 3);
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens/i?versao=3', { metodo: 'DELETE' });
    await ordenarItensDaVitrine(['b', 'a']);
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens/ordem', { metodo: 'PUT', corpo: { ids: ['b', 'a'] } });
  });

  it('foto: PUT multipart, DELETE e bytes com o token', async () => {
    const arquivo = new FormData();
    await trocarFotoDoItem('a/b', arquivo);
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens/a%2Fb/foto', { metodo: 'PUT', corpoBruto: arquivo, limiteMs: 60000 });
    await removerFotoDoItem('i');
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens/i/foto', { metodo: 'DELETE' });
    await baixarFotoDoItem('i');
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/itens/i/foto', { binario: true, limiteMs: 30000 });
  });

  it('aluno: nenhuma rota leva id de consultoria ou de aluno', async () => {
    await expect(vitrineDoAluno()).resolves.toBe('/aluno/vitrine');
    await baixarFotoDoItemDoAluno('../y');
    expect(requisicao).toHaveBeenLastCalledWith('/aluno/vitrine/itens/..%2Fy/foto', { binario: true, limiteMs: 30000 });
  });
});
