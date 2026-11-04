import { AppState, Platform, type AppStateStatus } from 'react-native';

import { registrarPushToken } from '../../api/rotas';
import { INTERVALO_RENOVACAO_DO_PUSH_MS } from '../../dominio/pushDoAluno';
import { obterPushDoAparelho, pushPermitido } from './pushNativo';
import { SincronizarPush } from './SincronizarPush';

/**
 * Renovação do token de push pela área do aluno: ao montar e ao voltar para a frente (no máximo uma vez a cada 24 h), só com
 * o aviso ligado, a chave ligada e a permissão do aparelho já dada; nunca pede permissão.
 */
const TOKEN = 'ExponentPushToken[abcdefgh12345678]';
let mockPush = true;
let mockLigado = true;

jest.mock('../../sessao/SessaoProvider', () => ({ useSessao: () => ({ pushHabilitado: mockPush }) }));
jest.mock('../../tema/TemaProvider', () => ({ useTema: () => ({ preferencias: { avisoNoCelular: mockLigado } }) }));
jest.mock('../../api/rotas', () => ({ registrarPushToken: jest.fn(async () => undefined) }));
jest.mock('./pushNativo', () => ({
  pushPermitido: jest.fn(async () => true),
  obterPushDoAparelho: jest.fn(async () => ({ estado: 'ok', token: 'ExponentPushToken[abcdefgh12345678]', plataforma: 'ANDROID' })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

let aoMudar: ((estado: AppStateStatus) => void) | null = null;
const remover = jest.fn();
let agora = 1_000_000;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockPush = true;
  mockLigado = true;
  aoMudar = null;
  agora = 1_000_000;
  Platform.OS = 'android';
  jest.mocked(pushPermitido).mockResolvedValue(true);
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
    raiz = Renderer.create(<SincronizarPush usuarioId="aluno-1" />);
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
  expect(registrarPushToken).toHaveBeenCalledTimes(1);
  expect(registrarPushToken).toHaveBeenCalledWith(TOKEN, 'ANDROID');

  agora += 60 * 60 * 1000;
  await voltarParaAFrente();
  expect(registrarPushToken).toHaveBeenCalledTimes(1);

  agora += INTERVALO_RENOVACAO_DO_PUSH_MS;
  await Renderer.act(async () => {
    aoMudar?.('background');
  });
  expect(registrarPushToken).toHaveBeenCalledTimes(1);
  await voltarParaAFrente();
  expect(registrarPushToken).toHaveBeenCalledTimes(2);
  expect(obterPushDoAparelho).toHaveBeenCalledWith(false);

  await Renderer.act(async () => raiz.unmount());
  expect(remover).toHaveBeenCalled();
});

it('sem a permissão do aparelho não registra nem pede permissão, também ao voltar', async () => {
  jest.mocked(pushPermitido).mockResolvedValue(false);
  await montar();
  agora += INTERVALO_RENOVACAO_DO_PUSH_MS;
  await voltarParaAFrente();
  expect(registrarPushToken).not.toHaveBeenCalled();
  expect(obterPushDoAparelho).not.toHaveBeenCalled();
});

it('com o aviso desligado ou a chave desligada nem escuta a volta', async () => {
  mockLigado = false;
  await montar();
  mockLigado = true;
  mockPush = false;
  await montar();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(pushPermitido).not.toHaveBeenCalled();
  expect(registrarPushToken).not.toHaveBeenCalled();
});

it('falha ao registrar não escapa e a próxima volta antes de 24 h não tenta de novo', async () => {
  jest.mocked(registrarPushToken).mockRejectedValueOnce(new Error('sem internet'));
  await montar();
  agora += 60 * 1000;
  await voltarParaAFrente();
  expect(registrarPushToken).toHaveBeenCalledTimes(1);
});
