import { requisicao } from './cliente';
import {
  alterarItemDaVitrine, baixarFotoDoItem, baixarFotoDoItemDoAluno, criarItemDaVitrine, excluirItemDaVitrine, itensDaVitrine, ordenarItensDaVitrine,
  caminhoDaFotoDaLoja, gravarPaginaDaVitrine, lojaPublica, lojasPublicas, novoLinkDaVitrine, paginaDaVitrine, removerFotoDoItem, trocarFotoDoItem, vitrineDoAluno,
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

  it('página pública: configuração da equipe, novo link e leitura pública sem renovar sessão', async () => {
    await paginaDaVitrine();
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/configuracao');
    await gravarPaginaDaVitrine({ paginaLigada: true, noMarketplace: true, versao: null });
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/configuracao', { metodo: 'PUT', corpo: { paginaLigada: true, noMarketplace: true, versao: null } });
    await novoLinkDaVitrine(4);
    expect(requisicao).toHaveBeenLastCalledWith('/vitrine/configuracao/novo-link', { metodo: 'POST', corpo: { versao: 4 } });
    await lojaPublica('../x');
    expect(requisicao).toHaveBeenLastCalledWith('/publico/loja/..%2Fx', { semRenovar: true });
  });

  it('lista de consultorias: GET público com página e tamanho, sem renovar sessão', async () => {
    await lojasPublicas(2, 30);
    expect(requisicao).toHaveBeenLastCalledWith('/publico/lojas?pagina=2&tamanho=30', { semRenovar: true });
  });

  it('o corpo do item leva noMarketplace', async () => {
    expect(corpo).toMatchObject({ naPaginaPublica: false, noMarketplace: false });
  });

  it('foto pública: só o caminho, com o código e o item codificados e a versão como chave', () => {
    expect(caminhoDaFotoDaLoja('abc', 'i/1')).toBe('/publico/loja/abc/itens/i%2F1/foto');
    expect(caminhoDaFotoDaLoja('abc', 'i', '2026-11-16T03:00:00Z')).toBe('/publico/loja/abc/itens/i/foto?v=2026-11-16T03%3A00%3A00Z');
    expect(caminhoDaFotoDaLoja('abc', 'i', null)).toBe('/publico/loja/abc/itens/i/foto');
  });
});
