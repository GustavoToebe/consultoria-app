import { requisicao } from './cliente';
import { desfazerImportacao, esquecerRespostasDaPlanilha } from './rotas';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('planilha completa', () => {
  it('esquecer as respostas salvas é um DELETE sem corpo nem id (vale para a consultoria da sessão)', async () => {
    await esquecerRespostasDaPlanilha();
    expect(requisicao).toHaveBeenLastCalledWith('/importacoes/planilha-completa/respostas-salvas', { metodo: 'DELETE' });
  });

  it('o id do desfazer é codificado', async () => {
    await expect(desfazerImportacao('../x')).resolves.toBe('/importacoes/..%2Fx/desfazer');
  });
});
