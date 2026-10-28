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

  it('renovação em 429 ou 5xx não encerra a sessão: vira "sem conexão" com a mensagem do servidor', async () => {
    for (const status of [429, 503]) {
      fetchSimulado.mockReset();
      fetchSimulado.mockImplementation((url: string) =>
        String(url).endsWith('/auth/refresh')
          ? Promise.resolve(json(status, { status, message: 'Muitas tentativas.', codigo: 'LIMITE', fieldErrors: null }))
          : Promise.resolve(erro401('TOKEN_EXPIRADO')));
      const { requisicao, renovarSessao, aoEncerrar } = carregarCliente();
      const encerrada = jest.fn();
      aoEncerrar(encerrada);

      await expect(renovarSessao()).rejects.toMatchObject({ status: 0, semConexao: true, message: 'Muitas tentativas.' });
      await expect(requisicao('/aluno/painel')).rejects.toMatchObject({ status: 0 });
      expect(encerrada).not.toHaveBeenCalled();
    }
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

  it('403 de regra do plano (mobilidade fora do plano) não renova a sessão, não repete e não a encerra', async () => {
    fetchSimulado.mockResolvedValue(json(403, { status: 403, message: 'Funcionalidade fora do plano.', codigo: 'FUNCIONALIDADE_FORA_DO_PLANO', fieldErrors: null }));
    const { requisicao, aoEncerrar } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);

    await expect(requisicao('/aluno/mobilidade/registros', { metodo: 'POST', corpo: { registros: [] } })).rejects.toMatchObject({
      status: 403,
      codigo: 'FUNCIONALIDADE_FORA_DO_PLANO',
    });
    expect(chamados(fetchSimulado)).toEqual(['/aluno/mobilidade/registros']);
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

  it('renovação que devolve outra pessoa (outra conta entrou em outra aba) encerra a sessão sem repetir', async () => {
    fetchSimulado.mockImplementation((url: string) =>
      Promise.resolve(String(url).endsWith('/auth/refresh')
        ? json(200, { ...SESSAO_NOVA, usuario: { id: 'treinador-1' } })
        : erro401('TOKEN_EXPIRADO')));
    const { requisicao, aoEncerrar, definirUsuarioDaSessao, recusadaPorTrocaDeUsuario } = carregarCliente();
    const encerrada = jest.fn();
    aoEncerrar(encerrada);
    definirUsuarioDaSessao('aluno-1');

    await expect(requisicao('/aluno/dieta')).rejects.toMatchObject({ status: 401 });
    expect(encerrada).toHaveBeenCalledTimes(1);
    expect(chamados(fetchSimulado)).toEqual(['/aluno/dieta', '/auth/refresh']);
    expect(recusadaPorTrocaDeUsuario()).toBe(true);
    expect(recusadaPorTrocaDeUsuario()).toBe(false);
  });

  it('renovação da mesma pessoa segue normal', async () => {
    let primeira = true;
    fetchSimulado.mockImplementation((url: string) => {
      if (String(url).endsWith('/auth/refresh')) return Promise.resolve(json(200, { ...SESSAO_NOVA, usuario: { id: 'aluno-1' } }));
      if (primeira) {
        primeira = false;
        return Promise.resolve(erro401('TOKEN_EXPIRADO'));
      }
      return Promise.resolve(json(200, { ok: true }));
    });
    const { requisicao, definirUsuarioDaSessao, recusadaPorTrocaDeUsuario } = carregarCliente();
    definirUsuarioDaSessao('aluno-1');

    await expect(requisicao('/aluno/dieta')).resolves.toEqual({ ok: true });
    expect(recusadaPorTrocaDeUsuario()).toBe(false);
  });

  it('409 de conflito de edição chega sem repetição', async () => {
    fetchSimulado.mockResolvedValue(json(409, { status: 409, message: 'Outra aba alterou.', codigo: 'CONFLITO_EDICAO' }));
    const { requisicao } = carregarCliente();

    await expect(requisicao('/planos/treino/1', { metodo: 'PUT', corpo: {} })).rejects.toMatchObject({ status: 409, codigo: 'CONFLITO_EDICAO' });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});

describe('cliente HTTP: ciclo desligado na plataforma', () => {
  let fetchSimulado: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = API;
    mockLerRefresh.mockResolvedValue('refresh-velho');
    fetchSimulado = jest.fn();
    global.fetch = fetchSimulado as unknown as typeof fetch;
  });

  it('503 CICLO_INDISPONIVEL_NO_APP avisa a sessão e relança o mesmo erro', async () => {
    fetchSimulado.mockResolvedValue(json(503, { status: 503, message: 'O acompanhamento do ciclo não está disponível.', codigo: 'CICLO_INDISPONIVEL_NO_APP', fieldErrors: null }));
    const { requisicao, aoCicloDesligado, ErroApi } = carregarCliente();
    const desligado = jest.fn();
    aoCicloDesligado(desligado);

    const erro = await requisicao('/aluno/ciclo').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status: 503, codigo: 'CICLO_INDISPONIVEL_NO_APP' });
    expect(desligado).toHaveBeenCalledTimes(1);
    expect(chamados(fetchSimulado)).toEqual(['/aluno/ciclo']);
  });

  it('vale também para gravação do ciclo', async () => {
    fetchSimulado.mockResolvedValue(json(503, { status: 503, message: 'x', codigo: 'CICLO_INDISPONIVEL_NO_APP', fieldErrors: null }));
    const { requisicao, aoCicloDesligado } = carregarCliente();
    const desligado = jest.fn();
    aoCicloDesligado(desligado);

    await expect(requisicao('/aluno/ciclo/registros', { metodo: 'POST', corpo: {} })).rejects.toMatchObject({ status: 503 });
    expect(desligado).toHaveBeenCalledTimes(1);
  });

  it('outros erros não avisam: 409 CICLO_INDISPONIVEL (sexo), 503 de outro código e 500', async () => {
    const { requisicao, aoCicloDesligado } = carregarCliente();
    const desligado = jest.fn();
    aoCicloDesligado(desligado);
    const casos: [number, string][] = [[409, 'CICLO_INDISPONIVEL'], [503, 'FINANCEIRO_INDISPONIVEL'], [500, 'CICLO_INDISPONIVEL_NO_APP']];
    for (const [status, codigo] of casos) {
      fetchSimulado.mockResolvedValue(json(status, { status, message: 'x', codigo, fieldErrors: null }));
      await expect(requisicao('/aluno/ciclo')).rejects.toMatchObject({ status, codigo });
    }
    expect(desligado).not.toHaveBeenCalled();
  });

  it('sem callback registrado (ou removido) o erro só é relançado', async () => {
    fetchSimulado.mockResolvedValue(json(503, { status: 503, message: 'x', codigo: 'CICLO_INDISPONIVEL_NO_APP', fieldErrors: null }));
    const { requisicao, aoCicloDesligado } = carregarCliente();
    const desligado = jest.fn();
    aoCicloDesligado(desligado);
    aoCicloDesligado(null);

    await expect(requisicao('/aluno/ciclo')).rejects.toMatchObject({ codigo: 'CICLO_INDISPONIVEL_NO_APP' });
    expect(desligado).not.toHaveBeenCalled();
  });
});

describe('cliente HTTP: imagem protegida', () => {
  let fetchSimulado: jest.Mock;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = API;
    mockLerRefresh.mockResolvedValue('refresh-velho');
    fetchSimulado = jest.fn();
    global.fetch = fetchSimulado as unknown as typeof fetch;
  });

  it('pede imagem aceitando JSON de erro e devolve o Blob, com o token só para a própria API', async () => {
    fetchSimulado.mockResolvedValue(new Response(new Blob(['bytes'], { type: 'image/jpeg' }), { status: 200, headers: { 'Content-Type': 'image/jpeg' } }));
    const { requisicao, guardarSessao } = carregarCliente();
    await guardarSessao({ accessToken: 'acesso', refreshToken: 'r' } as never);
    const imagem = await requisicao<Blob>('/aluno/fotos/abc', { binario: true });
    expect(imagem.size).toBeGreaterThan(0);
    const cabecalhos = fetchSimulado.mock.calls[0][1].headers as Record<string, string>;
    expect(cabecalhos.Accept).toBe('image/jpeg, application/zip, application/json');
    expect(cabecalhos.Authorization).toBe('Bearer acesso');
  });

  it('erro de uma rota de imagem continua vindo como ErroApi, sem tentar ler imagem', async () => {
    fetchSimulado.mockResolvedValue(json(404, { status: 404, message: 'Foto não encontrada.', codigo: 'NAO_ENCONTRADO', fieldErrors: null }));
    const { requisicao, ErroApi } = carregarCliente();
    await expect(requisicao('/aluno/fotos/x', { binario: true })).rejects.toBeInstanceOf(ErroApi);
  });
});

describe('cliente HTTP: renovação entre abas (Web Locks)', () => {
  const descritorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const descritorLocation = typeof window === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(window, 'location');
  let fetchSimulado: jest.Mock;

  /** Gerente de travas simulado: uma fila por nome, como o `navigator.locks` do navegador (compartilhado entre as abas). */
  function travasSimuladas() {
    const filas = new Map<string, Promise<unknown>>();
    return {
      request: <T,>(nome: string, tarefa: () => Promise<T>): Promise<T> => {
        const anterior = filas.get(nome) ?? Promise.resolve();
        const atual = anterior.then(tarefa, tarefa);
        filas.set(nome, atual.catch(() => undefined));
        return atual;
      },
    };
  }

  function definirNavigator(valor: unknown) {
    Object.defineProperty(globalThis, 'navigator', { value: valor, configurable: true, writable: true });
  }

  /** Cada "aba" é uma cópia isolada do módulo (token e refresh em andamento próprios), na plataforma pedida. */
  function carregarAba(os: 'web' | 'android'): Cliente {
    let cliente!: Cliente;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Platform } = require('react-native') as typeof import('react-native');
      jest.replaceProperty(Platform, 'OS', os);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cliente = require('./cliente') as Cliente;
    });
    return cliente;
  }

  /** `fetch` em que cada `/auth/refresh` fica pendente até o teste liberar; devolve os liberadores, na ordem de chegada. */
  function refreshesManuais() {
    const liberar: (() => void)[] = [];
    fetchSimulado.mockImplementation((url: string) => {
      const caminho = String(url).replace(API, '');
      if (caminho === '/auth/refresh') {
        return new Promise<Response>((resolve) => liberar.push(() => resolve(json(200, SESSAO_NOVA))));
      }
      return Promise.resolve(json(200, {}));
    });
    return liberar;
  }

  const darVez = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const refreshesIniciados = () => chamados(fetchSimulado).filter((c) => c === '/auth/refresh').length;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = API;
    mockLerRefresh.mockResolvedValue('refresh-velho');
    fetchSimulado = jest.fn();
    global.fetch = fetchSimulado as unknown as typeof fetch;
    // Na web a base das URLs relativas é a origem da página.
    if (typeof window !== 'undefined') Object.defineProperty(window, 'location', { value: { origin: 'http://app.teste' }, configurable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (descritorNavigator) Object.defineProperty(globalThis, 'navigator', descritorNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
    if (typeof window !== 'undefined') {
      if (descritorLocation) Object.defineProperty(window, 'location', descritorLocation);
      else delete (window as { location?: unknown }).location;
    }
  });

  it('na web, a renovação de outra aba só começa depois que a primeira termina', async () => {
    definirNavigator({ locks: travasSimuladas() });
    const liberar = refreshesManuais();
    const abaA = carregarAba('web');
    const abaB = carregarAba('web');

    const a = abaA.renovarSessao();
    const b = abaB.renovarSessao();
    await darVez();
    expect(refreshesIniciados()).toBe(1);

    liberar[0]();
    await a;
    await darVez();
    // A segunda só saiu depois de a primeira resolver (e de gravar o cookie novo).
    expect(refreshesIniciados()).toBe(2);
    expect(liberar).toHaveLength(2);

    liberar[1]();
    await expect(b).resolves.toMatchObject({ accessToken: 'acesso-novo' });
  });

  it('na mesma aba, chamadas simultâneas continuam esperando o mesmo refresh', async () => {
    definirNavigator({ locks: travasSimuladas() });
    const liberar = refreshesManuais();
    const aba = carregarAba('web');

    const chamadas = [aba.renovarSessao(), aba.renovarSessao(), aba.renovarSessao()];
    await darVez();
    liberar[0]();
    await Promise.all(chamadas);

    expect(refreshesIniciados()).toBe(1);
  });

  it('a trava é liberada quando o refresh falha: a próxima aba renova mesmo assim', async () => {
    definirNavigator({ locks: travasSimuladas() });
    let tentativa = 0;
    fetchSimulado.mockImplementation((url: string) => {
      if (!String(url).endsWith('/auth/refresh')) return Promise.resolve(json(200, {}));
      tentativa += 1;
      return Promise.resolve(tentativa === 1 ? json(503, { message: 'Indisponível.' }) : json(200, SESSAO_NOVA));
    });
    const abaA = carregarAba('web');
    const abaB = carregarAba('web');

    const a = abaA.renovarSessao();
    const b = abaB.renovarSessao();

    await expect(a).rejects.toBeDefined();
    await expect(b).resolves.toMatchObject({ accessToken: 'acesso-novo' });
  });

  it('sem navigator.locks na web, segue como antes: as abas renovam sem esperar umas pelas outras', async () => {
    definirNavigator({});
    const liberar = refreshesManuais();
    const abaA = carregarAba('web');
    const abaB = carregarAba('web');

    const a = abaA.renovarSessao();
    const b = abaB.renovarSessao();
    await darVez();
    expect(refreshesIniciados()).toBe(2);

    liberar.forEach((l) => l());
    await Promise.all([a, b]);
  });

  it('no celular não usa trava, mesmo que exista navigator.locks', async () => {
    const travas = { request: jest.fn() };
    definirNavigator({ locks: travas });
    fetchSimulado.mockImplementation(() => Promise.resolve(json(200, SESSAO_NOVA)));
    const aba = carregarAba('android');

    await expect(aba.renovarSessao()).resolves.toMatchObject({ accessToken: 'acesso-novo' });
    expect(travas.request).not.toHaveBeenCalled();
  });
});
