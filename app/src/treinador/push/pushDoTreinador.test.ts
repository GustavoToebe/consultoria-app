import { obterPushDoAparelho, pushPermitido } from '../../aluno/push/pushNativo';
import { carregarNotificacoes } from '../../aluno/compromissos/lembretes';
import { requisicao } from '../../api/cliente';
import {
  ativarPushDoTreinador, DESTINO_DO_TOQUE_DE_ATENCAO, destinoDoToque, ouvirToqueNaNotificacao, registrarPushDoTreinador,
  removerPushDoTreinadorAoSair,
} from './pushDoTreinador';
import { recebePushDeAtencao } from './regraDoPushDoTreinador';

/**
 * Push de atenção no aparelho do treinador (C7): só `/eu/push-token`, token só no corpo, permissão pedida só ao ativar, o
 * "Sair" apaga só o token deste aparelho e o toque leva à lista filtrada uma vez só.
 */
const TOKEN = 'ExponentPushToken[abcdefgh12345678]';

jest.mock('../../api/cliente', () => ({ requisicao: jest.fn(async () => undefined) }));
jest.mock('../../aluno/push/pushNativo', () => ({
  pushPermitido: jest.fn(async () => true),
  obterPushDoAparelho: jest.fn(async () => ({ estado: 'ok', token: 'ExponentPushToken[abcdefgh12345678]', plataforma: 'ANDROID' })),
}));
const mockNotificacoes = {
  DEFAULT_ACTION_IDENTIFIER: 'padrao',
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(async () => null as unknown),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
};
jest.mock('../../aluno/compromissos/lembretes', () => ({ carregarNotificacoes: jest.fn(async () => mockNotificacoes) }));

const resposta = (identifier: string, data: unknown, actionIdentifier = 'padrao') =>
  ({ actionIdentifier, notification: { request: { identifier, content: { data } } } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(pushPermitido).mockResolvedValue(true);
});

describe('regra de quem registra', () => {
  it('só no celular, com push e regras ligados e as duas permissões', () => {
    const base = { os: 'android', pushHabilitado: true, regrasAtencaoHabilitada: true, podeVer: true };
    expect(recebePushDeAtencao(base)).toBe(true);
    expect(recebePushDeAtencao({ ...base, os: 'ios' })).toBe(true);
    expect(recebePushDeAtencao({ ...base, os: 'web' })).toBe(false);
    expect(recebePushDeAtencao({ ...base, pushHabilitado: false })).toBe(false);
    expect(recebePushDeAtencao({ ...base, regrasAtencaoHabilitada: false })).toBe(false);
    expect(recebePushDeAtencao({ ...base, podeVer: false })).toBe(false);
  });
});

describe('token do aparelho', () => {
  it('ativar pede a permissão e registra em /eu/push-token com o token no corpo', async () => {
    await expect(ativarPushDoTreinador()).resolves.toBe('ok');
    expect(obterPushDoAparelho).toHaveBeenCalledWith(true);
    expect(requisicao).toHaveBeenCalledWith('/eu/push-token', { metodo: 'PUT', corpo: { token: TOKEN, plataforma: 'ANDROID' } });
  });

  it('ativar com a permissão negada não chama a API', async () => {
    jest.mocked(obterPushDoAparelho).mockResolvedValueOnce({ estado: 'negada' });
    await expect(ativarPushDoTreinador()).resolves.toBe('negada');
    expect(requisicao).not.toHaveBeenCalled();
  });

  it('registrar de novo nunca pede permissão; sem ela, não faz nada', async () => {
    await registrarPushDoTreinador();
    expect(obterPushDoAparelho).toHaveBeenCalledWith(false);
    expect(requisicao).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
    jest.mocked(pushPermitido).mockResolvedValue(false);
    await registrarPushDoTreinador();
    expect(obterPushDoAparelho).not.toHaveBeenCalled();
    expect(requisicao).not.toHaveBeenCalled();
  });

  it('o "Sair" apaga só o token deste aparelho (nunca o DELETE sem corpo) e falha não escapa', async () => {
    await removerPushDoTreinadorAoSair();
    expect(requisicao).toHaveBeenCalledWith('/eu/push-token', { metodo: 'DELETE', corpo: { token: TOKEN } });
    jest.clearAllMocks();
    jest.mocked(pushPermitido).mockResolvedValue(false);
    await removerPushDoTreinadorAoSair();
    expect(requisicao).not.toHaveBeenCalled();
    jest.mocked(pushPermitido).mockResolvedValue(true);
    jest.mocked(requisicao).mockRejectedValueOnce(new Error('sem internet'));
    await expect(removerPushDoTreinadorAoSair()).resolves.toBeUndefined();
  });
});

describe('toque na notificação', () => {
  it('só o toque no corpo de um push "atencao" leva à lista com o filtro', () => {
    expect(destinoDoToque(resposta('1', { tipo: 'atencao' }), 'padrao')).toBe('/treinador/atualizacoes?comAtencao=true');
    expect(destinoDoToque(resposta('1', { tipo: 'compromisso' }), 'padrao')).toBeNull();
    expect(destinoDoToque(resposta('1', undefined), 'padrao')).toBeNull();
    expect(destinoDoToque(resposta('1', { tipo: 'atencao' }, 'outra'), 'padrao')).toBeNull();
  });

  it('app aberto pela notificação: navega uma vez, limpa a última resposta e o ouvinte não repete a mesma', async () => {
    let ouvinte: ((r: unknown) => void) | null = null;
    const remover = jest.fn();
    mockNotificacoes.addNotificationResponseReceivedListener.mockImplementation((f: (r: unknown) => void) => { ouvinte = f; return { remove: remover }; });
    mockNotificacoes.getLastNotificationResponseAsync.mockResolvedValueOnce(resposta('n-1', { tipo: 'atencao' }));
    const navegar = jest.fn();
    const parar = await ouvirToqueNaNotificacao(navegar);
    expect(navegar).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith(DESTINO_DO_TOQUE_DE_ATENCAO);
    expect(mockNotificacoes.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    ouvinte!(resposta('n-1', { tipo: 'atencao' }));
    ouvinte!(resposta('n-2', { tipo: 'compromisso' }));
    expect(navegar).toHaveBeenCalledTimes(1);
    ouvinte!(resposta('n-3', { tipo: 'atencao' }));
    expect(navegar).toHaveBeenCalledTimes(2);
    parar();
    expect(remover).toHaveBeenCalled();
  });

  it('sem o módulo (Expo Go no Android) não ouve nada', async () => {
    jest.mocked(carregarNotificacoes).mockResolvedValueOnce(null);
    const parar = await ouvirToqueNaNotificacao(jest.fn());
    expect(mockNotificacoes.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(() => parar()).not.toThrow();
  });
});
