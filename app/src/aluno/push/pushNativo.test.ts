import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registrarPushToken, removerPushToken } from '../../api/rotas';
import { desligarPushDoAparelho, obterPushDoAparelho, pushPermitido, registrarPushDoAparelho, removerPushDoAparelho } from './pushNativo';

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
jest.mock('../../api/rotas', () => ({ registrarPushToken: jest.fn(async () => undefined), removerPushToken: jest.fn(async () => undefined) }));

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

  it('sem exigir a permissão (para apagar o token) busca o token mesmo com a permissão tirada, sem pedir nada', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    expect(await obterPushDoAparelho(false, false)).toEqual({ estado: 'ok', token: TOKEN, plataforma: 'ANDROID' });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
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

  it('com a permissão tirada depois de ligar, ainda apaga o token', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    await removerPushDoAparelho();
    expect(removerPushToken).toHaveBeenCalledWith(TOKEN);
  });

  it('sem token nenhum não chama a API (o "Sair" nunca apaga os dos outros aparelhos)', async () => {
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('sem token'));
    await removerPushDoAparelho();
    expect(removerPushToken).not.toHaveBeenCalled();
  });

  it('falha da API não bloqueia a saída', async () => {
    jest.mocked(removerPushToken).mockRejectedValueOnce(new Error('sem internet'));
    await expect(removerPushDoAparelho()).resolves.toBeUndefined();
  });
});

describe('desligarPushDoAparelho (o interruptor desligado)', () => {
  it('apaga o token deste aparelho', async () => {
    await desligarPushDoAparelho();
    expect(removerPushToken).toHaveBeenCalledWith(TOKEN);
  });

  it('sem a permissão do aparelho ainda busca o token e o apaga', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    await desligarPushDoAparelho();
    expect(removerPushToken).toHaveBeenCalledWith(TOKEN);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('se mesmo assim não há token, pede ao servidor que apague os do próprio usuário (sem informar token)', async () => {
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('sem token'));
    await desligarPushDoAparelho();
    expect(removerPushToken).toHaveBeenCalledTimes(1);
    expect(removerPushToken).toHaveBeenCalledWith(undefined);
  });

  it('falha da API sobe, para o interruptor avisar e continuar ligado', async () => {
    jest.mocked(removerPushToken).mockRejectedValueOnce(new Error('sem internet'));
    await expect(desligarPushDoAparelho()).rejects.toThrow('sem internet');
  });
});

describe('registrarPushDoAparelho (depois de trocar a senha)', () => {
  it('registra o token deste aparelho de novo', async () => {
    await registrarPushDoAparelho();
    expect(registrarPushToken).toHaveBeenCalledWith(TOKEN, 'ANDROID');
  });

  it('sem permissão nunca pede e nada registra', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce(permissao(false));
    await registrarPushDoAparelho();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registrarPushToken).not.toHaveBeenCalled();
  });
});
