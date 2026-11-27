/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

import { ativarPushDoTreinador, pushPermitido } from '../push/pushDoTreinador';
import { InterruptorDoPushDeAtencao, ROTULO_RECEBER_NESTE_CELULAR } from './InterruptorDoPushDeAtencao';

/**
 * "Avisos no celular" do treinador (C7): a permissão do aparelho só é pedida pelo "Receber neste celular" (a preferência nasce
 * ligada) ou ao ligar o interruptor; com a permissão já dada, ou na web, o botão não aparece. O e2e vê o cartão na web.
 */
let mockAtencao = true;
let mockPushLigado = true;
const mockAvisar = jest.fn();
const mockSalvar = jest.fn(async (c: { atencao: boolean }) => c);
jest.mock('../../sessao/SessaoProvider', () => ({
  useSessao: () => ({ pode: () => true, regrasAtencaoHabilitada: true, pushHabilitado: mockPushLigado }),
}));
jest.mock('../../api/rotas', () => ({
  obterPreferenciasDePush: jest.fn(),
  salvarPreferenciasDePush: (c: { atencao: boolean }) => mockSalvar(c),
}));
jest.mock('../../ui/useCarregar', () => ({
  useCarregar: () => ({ dados: { atencao: mockAtencao }, erro: undefined, recarregar: jest.fn(), definir: (d: { atencao: boolean }) => { mockAtencao = d.atencao; } }),
}));
jest.mock('../push/pushDoTreinador', () => ({
  pushPermitido: jest.fn(async () => false),
  ativarPushDoTreinador: jest.fn(async () => 'ok'),
}));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
const passa = ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children);
jest.mock('../../ui/Cartao', () => ({ Cartao: passa }));
jest.mock('../../ui/Estados', () => ({ MensagemErro: () => null }));
jest.mock('../../ui/Campos', () => ({
  Interruptor: ({ rotulo, aoMudar, valor }: { rotulo: string; aoMudar: (v: boolean) => void; valor: boolean }) =>
    require('react').createElement(require('react-native').Switch, { accessibilityLabel: rotulo, value: valor, onValueChange: aoMudar }),
}));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { onPress: aoTocar, accessibilityLabel: rotulo }),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

async function renderizar() {
  let r!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => { r = Renderer.create(<InterruptorDoPushDeAtencao />); });
  return r;
}
const botao = (r: import('react-test-renderer').ReactTestRenderer) =>
  r.root.findAll((n) => n.props.accessibilityLabel === ROTULO_RECEBER_NESTE_CELULAR && typeof n.props.onPress === 'function');

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockAtencao = true;
  mockPushLigado = true;
  Platform.OS = 'android';
  jest.mocked(pushPermitido).mockResolvedValue(false);
});

it('sem a permissão do aparelho: o botão pede a permissão só ao tocar e registra', async () => {
  const r = await renderizar();
  expect(ativarPushDoTreinador).not.toHaveBeenCalled();
  expect(botao(r)).toHaveLength(1);
  await Renderer.act(async () => botao(r)[0].props.onPress());
  expect(ativarPushDoTreinador).toHaveBeenCalledTimes(1);
  expect(botao(r)).toHaveLength(0);
});

it('permissão negada avisa e o botão continua', async () => {
  jest.mocked(ativarPushDoTreinador).mockResolvedValueOnce('negada');
  const r = await renderizar();
  await Renderer.act(async () => botao(r)[0].props.onPress());
  expect(mockAvisar).toHaveBeenCalledWith('Você pode liberar as notificações nas configurações do aparelho.');
  expect(botao(r)).toHaveLength(1);
});

it('erro de rede ao registrar avisa sem derrubar a tela', async () => {
  jest.mocked(ativarPushDoTreinador).mockRejectedValueOnce(new Error('sem internet'));
  const r = await renderizar();
  await Renderer.act(async () => botao(r)[0].props.onPress());
  expect(mockAvisar).toHaveBeenCalledWith(expect.any(String), 'perigo');
});

it('com a permissão já dada, na web ou com o push desligado, não há botão nem pedido', async () => {
  jest.mocked(pushPermitido).mockResolvedValue(true);
  expect(botao(await renderizar())).toHaveLength(0);
  jest.mocked(pushPermitido).mockResolvedValue(false);
  Platform.OS = 'web';
  expect(botao(await renderizar())).toHaveLength(0);
  Platform.OS = 'android';
  mockPushLigado = false;
  expect(botao(await renderizar())).toHaveLength(0);
  expect(ativarPushDoTreinador).not.toHaveBeenCalled();
});

it('com o aviso desligado não há botão; ligar o interruptor grava e pede a permissão', async () => {
  mockAtencao = false;
  const r = await renderizar();
  expect(botao(r)).toHaveLength(0);
  const interruptor = r.root.findAll((n) => typeof n.props.onValueChange === 'function')[0];
  await Renderer.act(async () => interruptor.props.onValueChange(true));
  expect(mockSalvar).toHaveBeenCalledWith({ atencao: true });
  expect(ativarPushDoTreinador).toHaveBeenCalledTimes(1);
});
