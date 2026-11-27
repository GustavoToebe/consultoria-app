import { AppState, Platform, type AppStateStatus } from 'react-native';

import { INTERVALO_RENOVACAO_DO_PUSH_MS } from '../../dominio/pushDoAluno';
import { ouvirToqueNaNotificacao, registrarPushDoTreinador } from './pushDoTreinador';
import { SincronizarPushDoTreinador } from './SincronizarPushDoTreinador';

/**
 * Renovação do token do treinador ao abrir e ao voltar para a frente (no máximo a cada 24 h), só no celular, com push e regras
 * ligados e as duas permissões; o toque leva à lista filtrada.
 */
let mockSessao = { push: true, regras: true, podeVer: true };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (destino: string) => mockPush(destino) } }));
jest.mock('../../sessao/SessaoProvider', () => ({
  useSessao: () => ({
    usuario: { id: 'treinador-1' }, pushHabilitado: mockSessao.push, regrasAtencaoHabilitada: mockSessao.regras,
    pode: () => mockSessao.podeVer,
  }),
}));
jest.mock('./pushDoTreinador', () => ({
  registrarPushDoTreinador: jest.fn(async () => undefined),
  ouvirToqueNaNotificacao: jest.fn(async () => () => undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

let aoMudar: ((estado: AppStateStatus) => void) | null = null;
const remover = jest.fn();
let agora = 1_000_000;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockSessao = { push: true, regras: true, podeVer: true };
  aoMudar = null;
  agora = 1_000_000;
  Platform.OS = 'android';
  jest.spyOn(Date, 'now').mockImplementation(() => agora);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, ouvinte) => {
    aoMudar = ouvinte as (estado: AppStateStatus) => void;
    return { remove: remover } as never;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function montar() {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => {
    raiz = Renderer.create(<SincronizarPushDoTreinador />);
  });
  return raiz;
}

async function voltarParaAFrente() {
  await Renderer.act(async () => {
    aoMudar?.('active');
  });
}

it('registra ao abrir e, ao voltar para a frente, só depois de 24 h', async () => {
  const raiz = await montar();
  expect(registrarPushDoTreinador).toHaveBeenCalledTimes(1);
  agora += 60 * 60 * 1000;
  await voltarParaAFrente();
  expect(registrarPushDoTreinador).toHaveBeenCalledTimes(1);
  agora += INTERVALO_RENOVACAO_DO_PUSH_MS;
  await voltarParaAFrente();
  expect(registrarPushDoTreinador).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => raiz.unmount());
  expect(remover).toHaveBeenCalled();
});

it('sem a chave do push, sem as regras ou sem permissão de ver os pontos, não registra', async () => {
  for (const s of [{ push: false, regras: true, podeVer: true }, { push: true, regras: false, podeVer: true }, { push: true, regras: true, podeVer: false }]) {
    mockSessao = s;
    const raiz = await montar();
    await Renderer.act(async () => raiz.unmount());
  }
  expect(registrarPushDoTreinador).not.toHaveBeenCalled();
});

it('na web não registra nem ouve toque', async () => {
  Platform.OS = 'web';
  await montar();
  expect(registrarPushDoTreinador).not.toHaveBeenCalled();
  expect(ouvirToqueNaNotificacao).not.toHaveBeenCalled();
});

it('falha ao registrar não escapa', async () => {
  jest.mocked(registrarPushDoTreinador).mockRejectedValueOnce(new Error('sem internet'));
  await expect(montar()).resolves.toBeDefined();
});

it('o toque leva ao destino pelo router', async () => {
  jest.mocked(ouvirToqueNaNotificacao).mockImplementationOnce(async (navegar) => {
    navegar('/treinador/atualizacoes?comAtencao=true');
    return () => undefined;
  });
  await montar();
  expect(mockPush).toHaveBeenCalledWith('/treinador/atualizacoes?comAtencao=true');
});
