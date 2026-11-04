import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { removerPushToken } from '../../api/rotas';
import { obterPushDoAparelho, pushPermitido, removerPushDoAparelho } from './pushNativo';

const TOKEN = 'ExponentPushToken[abcdefgh12345678]';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[abcdefgh12345678]' })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'projeto-fictício' } } }, executionEnvironment: 'standalone' },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
jest.mock('../../api/rotas', () => ({ removerPushToken: jest.fn(async () => undefined) }));

const permissao = (granted: boolean) => ({ granted, canAskAgain: true }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
});

describe('obterPushDoAparelho', () => {
  it('com permissão devolve o token e a plataforma, e o projeto vem da configuração', async () => {
    expect(await obterPushDoAparelho(false)).toEqual({ estado: 'ok', token: TOKEN, plataforma: 'ANDROID' });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'projeto-fictício' });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('sem permissão e sem pedir: negada, sem pedir nem buscar token', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    expect(await obterPushDoAparelho(false)).toEqual({ estado: 'negada' });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('pedindo: pede a permissão uma vez; recusada, fica negada', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce(permissao(false));
    expect(await obterPushDoAparelho(true)).toEqual({ estado: 'negada' });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('o Expo falhando ou devolvendo algo fora do formato vira indisponível, sem lançar', async () => {
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('rede'));
    expect(await obterPushDoAparelho(false)).toEqual({ estado: 'indisponivel' });
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValueOnce({ type: 'expo', data: 'qualquer-coisa' } as never);
    expect(await obterPushDoAparelho(false)).toEqual({ estado: 'indisponivel' });
  });

  it('web não tem push', async () => {
    Platform.OS = 'web';
    expect(await obterPushDoAparelho(true)).toEqual({ estado: 'indisponivel' });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('pushPermitido', () => {
  it('diz se o aparelho deixa notificar, sem pedir nada', async () => {
    expect(await pushPermitido()).toBe(true);
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    expect(await pushPermitido()).toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('removerPushDoAparelho (o "Sair")', () => {
  it('apaga o token deste aparelho na API', async () => {
    await removerPushDoAparelho();
    expect(removerPushToken).toHaveBeenCalledWith(TOKEN);
  });

  it('sem permissão não chama a API', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    await removerPushDoAparelho();
    expect(removerPushToken).not.toHaveBeenCalled();
  });

  it('falha da API não bloqueia a saída', async () => {
    jest.mocked(removerPushToken).mockRejectedValueOnce(new Error('sem internet'));
    await expect(removerPushDoAparelho()).resolves.toBeUndefined();
  });
});
