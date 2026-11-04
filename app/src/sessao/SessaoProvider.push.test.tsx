import AsyncStorage from '@react-native-async-storage/async-storage';

import { chaveDasPreferencias } from '../dominio/preferencias';
import { registrarPushDoAparelho, removerPushDoAparelho } from '../aluno/push/pushNativo';
import { SessaoProvider, useSessao } from './SessaoProvider';

/**
 * O "Sair" e a troca de senha do aluno diante do push do Expo, com o SessaoProvider de verdade e tudo em volta simulado
 * (API, armazenamento seguro, limpezas): o Expo só é tocado por quem ligou o aviso neste aparelho, e a troca de senha (que
 * apaga os tokens na API) registra o token do aparelho de novo.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));

const mockLogin = { accessToken: 'a', usuario: { id: 'aluno-1', papel: 'ALUNO', nome: 'Aluno Fictício' } };
let mockEu: Record<string, unknown> = {};
jest.mock('../api/cliente', () => ({
  aoCicloDesligado: jest.fn(),
  aoRetornoDesligado: jest.fn(),
  aoEncerrar: jest.fn(),
  definirUsuarioDaSessao: jest.fn(),
  ErroApi: class ErroApi extends Error { semConexao = false; },
  guardarSessao: jest.fn(async () => undefined),
  limparSessaoLocal: jest.fn(async () => undefined),
  recusadaPorTrocaDeUsuario: jest.fn(() => false),
  renovarSessao: jest.fn(async () => mockLogin),
}));
jest.mock('../api/rotas', () => ({
  eu: jest.fn(async () => mockEu),
  trocarSenha: jest.fn(async () => mockLogin),
  sairDaApi: jest.fn(async () => undefined),
}));
jest.mock('../aluno/push/pushNativo', () => ({
  registrarPushDoAparelho: jest.fn(async () => undefined),
  removerPushDoAparelho: jest.fn(async () => undefined),
}));
jest.mock('../dominio/encerrarSessaoLocal', () => ({ apagarDadosDaSessaoLocal: jest.fn(async () => undefined) }));
jest.mock('../offline/filasRetidas', () => ({ varrerFilasRetidas: jest.fn(async () => undefined) }));
jest.mock('../offline/limparDadosDoAluno', () => ({ limparDadosDoAluno: jest.fn(async () => undefined) }));
jest.mock('../offline/arquivosTemporarios', () => ({ apagarArquivosTemporarios: jest.fn() }));
jest.mock('../pdf/logoEmMemoria', () => ({ limparLogosEmMemoria: jest.fn() }));
jest.mock('./armazenamentoSeguro', () => ({ lerRefresh: jest.fn(async () => 'refresh') }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Sessao = ReturnType<typeof useSessao>;

const montados: import('react-test-renderer').ReactTestRenderer[] = [];
afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
});

/** Monta o provedor e devolve a leitura da sessão no momento da chamada (o valor muda a cada render). */
async function montar(eu: Record<string, unknown>): Promise<() => Sessao> {
  mockEu = { usuario: mockLogin.usuario, marca: { nome: 'Marca Fictícia' }, ...eu };
  let ultima!: Sessao;
  function Sonda() {
    ultima = useSessao();
    return null;
  }
  await Renderer.act(async () => {
    montados.push(Renderer.create(<SessaoProvider><Sonda /></SessaoProvider>));
  });
  expect(ultima.situacao).toBe('autenticado');
  return () => ultima;
}

const ligarAviso = (ligado: boolean) =>
  AsyncStorage.setItem(chaveDasPreferencias('aluno-1'), JSON.stringify({ avisoNoCelular: ligado }));

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('Sair do aluno', () => {
  it('com o aviso ligado neste aparelho apaga o token antes de encerrar', async () => {
    await ligarAviso(true);
    const sessao = await montar({ pushHabilitado: true });
    await Renderer.act(async () => sessao().sair());
    expect(removerPushDoAparelho).toHaveBeenCalledTimes(1);
  });

  it('sem o aviso ligado nem toca no Expo', async () => {
    await ligarAviso(false);
    const sessao = await montar({ pushHabilitado: true });
    await Renderer.act(async () => sessao().sair());
    expect(removerPushDoAparelho).not.toHaveBeenCalled();
    expect(sessao().situacao).toBe('anonimo');
  });

  it('sem preferência salva também não toca no Expo', async () => {
    const sessao = await montar({ pushHabilitado: true });
    await Renderer.act(async () => sessao().sair());
    expect(removerPushDoAparelho).not.toHaveBeenCalled();
  });

  it('com a chave da plataforma desligada depois de ligar o aviso, ainda apaga o token (o DELETE não depende da chave)', async () => {
    await ligarAviso(true);
    const sessao = await montar({ pushHabilitado: false });
    await Renderer.act(async () => sessao().sair());
    expect(removerPushDoAparelho).toHaveBeenCalledTimes(1);
    expect(sessao().situacao).toBe('anonimo');
  });

  it('com a chave desligada e sem o aviso ligado não toca no Expo', async () => {
    await ligarAviso(false);
    const sessao = await montar({ pushHabilitado: false });
    await Renderer.act(async () => sessao().sair());
    expect(removerPushDoAparelho).not.toHaveBeenCalled();
  });

  it('falha ao apagar o token não bloqueia a saída', async () => {
    await ligarAviso(true);
    const sessao = await montar({ pushHabilitado: true });
    jest.mocked(removerPushDoAparelho).mockRejectedValueOnce(new Error('sem internet'));
    await Renderer.act(async () => sessao().sair());
    expect(sessao().situacao).toBe('anonimo');
  });
});

describe('trocar a própria senha', () => {
  it('a API apaga os tokens: com o aviso ligado, registra o token deste aparelho de novo', async () => {
    await ligarAviso(true);
    const sessao = await montar({ pushHabilitado: true });
    await Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'));
    expect(registrarPushDoAparelho).toHaveBeenCalledTimes(1);
  });

  it('com a chave desligada não registra (o PUT daria 503)', async () => {
    await ligarAviso(true);
    const sessao = await montar({ pushHabilitado: false });
    await Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'));
    expect(registrarPushDoAparelho).not.toHaveBeenCalled();
  });

  it('sem o aviso ligado não registra nada', async () => {
    await ligarAviso(false);
    const sessao = await montar({ pushHabilitado: true });
    await Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'));
    expect(registrarPushDoAparelho).not.toHaveBeenCalled();
  });

  it('falha ao registrar não derruba a troca de senha', async () => {
    await ligarAviso(true);
    const sessao = await montar({ pushHabilitado: true });
    jest.mocked(registrarPushDoAparelho).mockRejectedValueOnce(new Error('sem internet'));
    await expect(Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'))).resolves.toBeUndefined();
  });
});
