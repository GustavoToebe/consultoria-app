import { aplicarAlteracaoDaAnamnese, buscarQuestionario, descartarAlteracaoDaAnamnese, fatoresDosAlimentos, inscricao, inscricaoPublica, listarPlanos } from './rotas';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('caminhos da API', () => {
  it('id vindo do endereço da tela é codificado: "../" não vira outra rota com o token de quem abriu', async () => {
    await expect(buscarQuestionario('../../alunos/x')).resolves.toBe('/questionarios/..%2F..%2Falunos%2Fx');
    await expect(listarPlanos('treino', 'a/b')).resolves.toBe('/alunos/a%2Fb/planos-treino');
  });

  it('código do link de inscrição e id da inscrição também são codificados', async () => {
    await expect(inscricaoPublica('../alunos')).resolves.toBe('/publico/inscricoes/..%2Falunos');
    await expect(inscricao('a/b')).resolves.toBe('/inscricoes/a%2Fb');
    await expect(inscricaoPublica('Ab-_09xYzAb-_09xYzAb-_09')).resolves.toBe('/publico/inscricoes/Ab-_09xYzAb-_09xYzAb-_09');
  });

  it('ids dos fatores vão separados por vírgula, cada um codificado', async () => {
    await expect(fatoresDosAlimentos(['a', 'b,c', '../x'])).resolves.toBe('/alimentos/fatores?ids=a,b%2Cc,..%2Fx');
  });

  it('alteração do cadastro proposta pela anamnese: os dois ids codificados', async () => {
    await expect(aplicarAlteracaoDaAnamnese('a/b', '../c')).resolves.toBe('/anamneses/a%2Fb/alteracoes/..%2Fc/aplicar');
    await expect(descartarAlteracaoDaAnamnese('a', 'b')).resolves.toBe('/anamneses/a/alteracoes/b/descartar');
  });

  it('uuid comum passa igual', async () => {
    await expect(buscarQuestionario('5d1c2a40-0000-4000-8000-000000000001')).resolves.toBe('/questionarios/5d1c2a40-0000-4000-8000-000000000001');
  });
});
