import { buscarQuestionario, listarPlanos } from './rotas';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('caminhos da API', () => {
  it('id vindo do endereço da tela é codificado: "../" não vira outra rota com o token de quem abriu', async () => {
    await expect(buscarQuestionario('../../alunos/x')).resolves.toBe('/questionarios/..%2F..%2Falunos%2Fx');
    await expect(listarPlanos('treino', 'a/b')).resolves.toBe('/alunos/a%2Fb/planos-treino');
  });

  it('uuid comum passa igual', async () => {
    await expect(buscarQuestionario('5d1c2a40-0000-4000-8000-000000000001')).resolves.toBe('/questionarios/5d1c2a40-0000-4000-8000-000000000001');
  });
});
