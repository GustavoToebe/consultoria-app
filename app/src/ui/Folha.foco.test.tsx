/* eslint-disable @typescript-eslint/no-require-imports */
import { AccessibilityInfo, Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ATRASO_DO_FOCO_MS } from '../dominio/focoDaFolha';
import { Folha } from './Folha';

/** A Folha de verdade: a prop do clique de acessibilidade chega ao painel e o foco volta ao gatilho ao fechar (celular). */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/portal', () => ({ PortalHost: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./useMovimentoReduzido', () => ({ useMovimentoReduzido: () => false }));
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const gesto: object = new Proxy(() => gesto, { get: () => () => gesto });
  return { GestureHandlerRootView: View, GestureDetector: ({ children }: { children?: unknown }) => children, Gesture: { Pan: () => gesto } };
});
jest.mock('./Texto', () => ({ Texto: () => null }));
jest.mock('./IconeBotao', () => ({ IconeBotao: () => null }));
jest.mock('./RolagemComTopo', () => ({ RolagemComTopo: () => null }));
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

const folha = (visivel: boolean) => <Folha visivel={visivel} titulo="T" aoFechar={() => undefined}>{null}</Folha>;

it('Folha no celular: o clique do leitor dentro do painel vira o gatilho e o foco volta a ele ao fechar', async () => {
  jest.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const enviar = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReset().mockImplementation(() => undefined);
  const botao = { isConnected: true };
  // Abre, e já com a Folha aberta o clique do leitor passa pelo `onClickCapture` do painel (o que a raiz do app também faz).
  let raiz!: ReactTestRenderer;
  await act(async () => { raiz = create(folha(false)); });
  await act(async () => { raiz.update(folha(true)); });
  const comCaptura = raiz.root.findAll((no) => typeof no.props.onClickCapture === 'function' && typeof no.type === 'string');
  expect(comCaptura.length).toBeGreaterThan(0);
  // O gatilho é lido ao abrir: este clique é para a próxima abertura.
  act(() => { comCaptura[0].props.onClickCapture({ target: botao, nativeEvent: {} }); });
  await act(async () => { raiz.update(folha(false)); });
  await act(async () => { raiz.update(folha(true)); });
  await act(async () => { raiz.update(folha(false)); });
  await act(async () => { jest.advanceTimersByTime(ATRASO_DO_FOCO_MS); });
  expect(enviar).toHaveBeenCalledWith(botao, 'focus');
  jest.restoreAllMocks();
  jest.useRealTimers();
});
