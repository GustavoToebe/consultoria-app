import { Platform } from 'react-native';

import { registrarPushToken } from '../../api/rotas';
import { AVISO_PUSH_FALHOU, AVISO_PUSH_NAO_DESLIGOU, AVISO_PUSH_NEGADO, ROTULO_DO_AVISO_NO_CELULAR } from '../../dominio/pushDoAluno';
import { InterruptorDeAvisoNoCelular } from './InterruptorDeAvisoNoCelular';
import { desligarPushDoAparelho, obterPushDoAparelho, pushPermitido } from './pushNativo';

/**
 * "Avisar no celular quando um compromisso mudar" (Conta › Aparência e preferências): ligar pede a permissão e registra o
 * token; desligar apaga o token mesmo sem a permissão; falha da API deixa o interruptor como estava e avisa.
 */
const TOKEN = 'ExponentPushToken[abcdefgh12345678]';
let mockPush = true;
let mockLigado = false;
const mockEscolher = jest.fn();
const mockAvisar = jest.fn();

jest.mock('../../sessao/SessaoProvider', () => ({ useSessao: () => ({ pushHabilitado: mockPush }) }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ preferencias: { avisoNoCelular: mockLigado }, escolherPreferencia: mockEscolher }),
}));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
jest.mock('../../api/rotas', () => ({ registrarPushToken: jest.fn(async () => undefined) }));
jest.mock('./pushNativo', () => ({
  pushPermitido: jest.fn(async () => true),
  obterPushDoAparelho: jest.fn(async () => ({ estado: 'ok', token: 'ExponentPushToken[abcdefgh12345678]', plataforma: 'ANDROID' })),
  desligarPushDoAparelho: jest.fn(async () => undefined),
}));
// Peças da tela trocadas por caixas que só guardam as props (o Interruptor real lê as cores do tema).
jest.mock('../../ui/Campos', () => ({ Interruptor: (p: object) => { const { View } = jest.requireActual('react-native'); return <View testID="interruptor" {...p} />; } }));
jest.mock('../../ui/Cartao', () => ({ Cartao: (p: { children: unknown }) => p.children }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Props = { rotulo: string; valor: boolean; aoMudar: (v: boolean) => void };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockPush = true;
  mockLigado = false;
  Platform.OS = 'android';
  jest.mocked(pushPermitido).mockResolvedValue(true);
});

async function montar() {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => {
    raiz = Renderer.create(<InterruptorDeAvisoNoCelular />);
  });
  return raiz;
}

function interruptor(raiz: import('react-test-renderer').ReactTestRenderer): Props {
  return raiz.root.findByProps({ testID: 'interruptor' }).props as Props;
}

async function mudar(raiz: import('react-test-renderer').ReactTestRenderer, ligar: boolean) {
  await Renderer.act(async () => {
    interruptor(raiz).aoMudar(ligar);
  });
}

it('ligar pede a permissão, registra o token deste aparelho e grava a preferência', async () => {
  const raiz = await montar();
  expect(interruptor(raiz).rotulo).toBe(ROTULO_DO_AVISO_NO_CELULAR);
  expect(interruptor(raiz).valor).toBe(false);
  await mudar(raiz, true);
  expect(obterPushDoAparelho).toHaveBeenCalledWith(true);
  expect(registrarPushToken).toHaveBeenCalledWith(TOKEN, 'ANDROID');
  expect(mockEscolher).toHaveBeenCalledWith({ avisoNoCelular: true });
});

it('desligar apaga o token e grava a preferência, sem pedir permissão', async () => {
  mockLigado = true;
  const raiz = await montar();
  await mudar(raiz, false);
  expect(desligarPushDoAparelho).toHaveBeenCalledTimes(1);
  expect(obterPushDoAparelho).not.toHaveBeenCalled();
  expect(mockEscolher).toHaveBeenCalledWith({ avisoNoCelular: false });
});

it('permissão negada não registra, não liga e explica onde liberar', async () => {
  jest.mocked(obterPushDoAparelho).mockResolvedValueOnce({ estado: 'negada' } as never);
  const raiz = await montar();
  await mudar(raiz, true);
  expect(registrarPushToken).not.toHaveBeenCalled();
  expect(mockEscolher).not.toHaveBeenCalled();
  expect(mockAvisar).toHaveBeenCalledWith(AVISO_PUSH_NEGADO);
});

it('falha da API deixa o interruptor como estava e avisa', async () => {
  jest.mocked(registrarPushToken).mockRejectedValueOnce(new Error('sem internet'));
  const raiz = await montar();
  await mudar(raiz, true);
  expect(mockEscolher).not.toHaveBeenCalled();
  expect(mockAvisar).toHaveBeenCalledWith(AVISO_PUSH_FALHOU, 'perigo');

  mockLigado = true;
  jest.mocked(desligarPushDoAparelho).mockRejectedValueOnce(new Error('sem internet'));
  const ligado = await montar();
  await mudar(ligado, false);
  expect(mockEscolher).not.toHaveBeenCalled();
  expect(mockAvisar).toHaveBeenCalledWith(AVISO_PUSH_NAO_DESLIGOU, 'perigo');
});

it('não aparece na web, com a chave desligada nem sem suporte no aparelho', async () => {
  Platform.OS = 'web';
  expect((await montar()).toJSON()).toBeNull();
  Platform.OS = 'android';
  mockPush = false;
  expect((await montar()).toJSON()).toBeNull();
  mockPush = true;
  jest.mocked(pushPermitido).mockResolvedValueOnce(null);
  expect((await montar()).toJSON()).toBeNull();
});
