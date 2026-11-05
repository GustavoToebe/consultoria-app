import { requisicao } from './cliente';
import { amostraDaPlanilhaCompleta, confirmarPlanilhaCompleta, desfazerImportacao, esquecerRespostasDaPlanilha } from './rotas';

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

  it('a confirmação leva os alunos ignorados num parâmetro à parte do hash, e sem eles não leva nada', async () => {
    const arquivo = new FormData();
    await confirmarPlanilhaCompleta(arquivo, 'a/b');
    expect(requisicao).toHaveBeenLastCalledWith('/importacoes/planilha-completa/confirmar?hash=a%2Fb', { metodo: 'POST', corpoBruto: arquivo });
    await confirmarPlanilhaCompleta(arquivo, 'h', [2, 4]);
    expect(requisicao).toHaveBeenLastCalledWith('/importacoes/planilha-completa/confirmar?hash=h&alunosIgnorados=2,4', { metodo: 'POST', corpoBruto: arquivo });
  });

  it('o id do desfazer é codificado', async () => {
    await expect(desfazerImportacao('../x')).resolves.toBe('/importacoes/..%2Fx/desfazer');
  });
});
