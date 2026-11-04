import { requisicao } from './cliente';
import { amostraDaPlanilhaCompleta, desfazerImportacao, esquecerRespostasDaPlanilha } from './rotas';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('planilha completa', () => {
  it('esquecer as respostas salvas é um DELETE sem corpo nem id (vale para a consultoria da sessão)', async () => {
    await esquecerRespostasDaPlanilha();
    expect(requisicao).toHaveBeenLastCalledWith('/importacoes/planilha-completa/respostas-salvas', { metodo: 'DELETE' });
  });

  it('a amostra é um POST do arquivo com a posição de partida', async () => {
    const arquivo = new FormData();
    await amostraDaPlanilhaCompleta(arquivo, 5);
    expect(requisicao).toHaveBeenLastCalledWith('/importacoes/planilha-completa/amostra?inicio=5', { metodo: 'POST', corpoBruto: arquivo });
  });

  it('o id do desfazer é codificado', async () => {
    await expect(desfazerImportacao('../x')).resolves.toBe('/importacoes/..%2Fx/desfazer');
  });
});
