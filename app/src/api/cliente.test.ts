/**
 * Refresh compartilhado do cliente HTTP: vários 401 ao mesmo tempo esperam um refresh só e cada requisição se repete
 * uma vez; refresh recusado encerra a sessão; erro de regra de negócio nunca renova nem repete. `fetch` é simulado e
 * cada teste carrega o módulo de novo (`jest.isolateModules`), porque o token e o refresh em andamento são do módulo.
 */
const mockLerRefresh = jest.fn<Promise<string | null>, []>();
jest.mock('../sessao/armazenamentoSeguro', () => ({
  lerRefresh: () => mockLerRefresh(),
  salvarRefresh: jest.fn(() => Promise.resolve()),
  apagarRefresh: jest.fn(() => Promise.resolve()),
}));

type Cliente = typeof import('./cliente');

const API = 'http://api.teste/api';
const SESSAO_NOVA = { accessToken: 'acesso-novo', refreshToken: 'refresh-novo' };

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const erro401 = (codigo: string) => json(401, { status: 401, message: 'Sessão expirada.', codigo, fieldErrors: null });

function carregarCliente(): Cliente {
  let cliente!: Cliente;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cliente = require('./cliente') as Cliente;
  });
  return cliente;
}

/** Caminhos chamados, na ordem, sem a base da API. */
function chamados(fetchSimulado: jest.Mock): string[] {
  return fetchSimulado.mock.calls.map((c) => String(c[0]).replace(API, ''));
}

describe('cliente HTTP: refresh compartilhado', () => {
  let fetchSimulado: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = API;
    mockLerRefresh.mockResolvedValue('refresh-velho');
    fetchSimulado = jest.fn();
    global.fetch = fetchSimulado as unknown as typeof fetch;
  });

  it('dois 401 ao mesmo tempo fazem um refresh só e cada requisição se repete uma vez', async () => {
    const vistos = new Map<string, number>();
    fetchSimulado.mockImplementation((url: string) => {
      const caminho = String(url).replace(API, '');
      if (caminho === '/auth/refresh') return Promise.resolve(json(200, SESSAO_NOVA));
      const vez = (vistos.get(caminho) ?? 0) + 1;
      vistos.set(caminho, vez);
      return Promise.resolve(vez === 1 ? erro401('TOKEN_EXPIRADO') : json(200, { ok: caminho }));
    });
    const { requisicao, aoEncerrar } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);

    const [a, b] = await Promise.all([requisicao<{ ok: string }>('/aluno/a'), requisicao<{ ok: string }>('/aluno/b')]);

    expect(a).toEqual({ ok: '/aluno/a' });
    expect(b).toEqual({ ok: '/aluno/b' });
    const caminhos = chamados(fetchSimulado);
    expect(caminhos.filter((c) => c === '/auth/refresh')).toHaveLength(1);
    expect(caminhos.filter((c) => c === '/aluno/a')).toHaveLength(2);
    expect(caminhos.filter((c) => c === '/aluno/b')).toHaveLength(2);
    expect(encerrada).not.toHaveBeenCalled();
  });

  it('a repetição leva o token novo', async () => {
    let primeira = true;
    fetchSimulado.mockImplementation((url: string, init: RequestInit) => {
      if (String(url).endsWith('/auth/refresh')) return Promise.resolve(json(200, SESSAO_NOVA));
      if (primeira) {
        primeira = false;
        return Promise.resolve(erro401('TOKEN_EXPIRADO'));
      }
      return Promise.resolve(json(200, { autorizacao: (init.headers as Record<string, string>).Authorization }));
    });
    const { requisicao } = carregarCliente();

    await expect(requisicao('/aluno/painel')).resolves.toEqual({ autorizacao: 'Bearer acesso-novo' });
  });

  it('refresh recusado encerra a sessão e a requisição falha com 401', async () => {
    fetchSimulado.mockImplementation((url: string) =>
      Promise.resolve(String(url).endsWith('/auth/refresh') ? json(401, { status: 401, message: 'Sessão encerrada.', codigo: 'REFRESH_INVALIDO' }) : erro401('TOKEN_EXPIRADO')));
    const { requisicao, aoEncerrar, ErroApi } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);

    await expect(requisicao('/aluno/painel')).rejects.toBeInstanceOf(ErroApi);
    expect(encerrada).toHaveBeenCalledTimes(1);
    expect(chamados(fetchSimulado)).toEqual(['/aluno/painel', '/auth/refresh']);
  });

  it('sem conexão no refresh a sessão não é encerrada', async () => {
    fetchSimulado.mockImplementation((url: string) =>
      String(url).endsWith('/auth/refresh') ? Promise.reject(new Error('rede')) : Promise.resolve(erro401('TOKEN_EXPIRADO')));
    const { requisicao, aoEncerrar } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);

    await expect(requisicao('/aluno/painel')).rejects.toMatchObject({ status: 0, codigo: 'SEM_CONEXAO' });
    expect(encerrada).not.toHaveBeenCalled();
  });

  it('CONFLITO_EDICAO não renova a sessão nem repete', async () => {
    fetchSimulado.mockResolvedValue(erro401('CONFLITO_EDICAO'));
    const { requisicao, aoEncerrar } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);

    await expect(requisicao('/planos/treino/1', { metodo: 'PUT', corpo: {} })).rejects.toMatchObject({ codigo: 'CONFLITO_EDICAO' });
    expect(chamados(fetchSimulado)).toEqual(['/planos/treino/1']);
    expect(encerrada).not.toHaveBeenCalled();
  });

  it('código de verificação errado (401) não renova a sessão nem a encerra', async () => {
    fetchSimulado.mockResolvedValue(erro401('MFA_CODIGO_INVALIDO'));
    const { requisicao, aoEncerrar } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);

    await expect(requisicao('/eu/mfa/ativar', { metodo: 'POST', corpo: {} })).rejects.toMatchObject({ codigo: 'MFA_CODIGO_INVALIDO' });
    expect(chamados(fetchSimulado)).toEqual(['/eu/mfa/ativar']);
    expect(encerrada).not.toHaveBeenCalled();
  });

  it('409 de conflito de edição chega sem repetição', async () => {
    fetchSimulado.mockResolvedValue(json(409, { status: 409, message: 'Outra aba alterou.', codigo: 'CONFLITO_EDICAO' }));
    const { requisicao } = carregarCliente();

    await expect(requisicao('/planos/treino/1', { metodo: 'PUT', corpo: {} })).rejects.toMatchObject({ status: 409, codigo: 'CONFLITO_EDICAO' });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});
