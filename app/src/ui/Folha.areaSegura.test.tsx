/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Folha } from './Folha';

/** Folha de baixo no Android (edge-to-edge): o painel, com o rodapé dentro, leva a margem de baixo da área segura. */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/portal', () => ({ PortalHost: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
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

it.each(['android', 'ios'] as const)('Folha de baixo (%s): o painel tem a margem inferior da área segura', async (so) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.replaceProperty(Platform, 'OS', so);
  let raiz!: ReactTestRenderer;
  await act(async () => { raiz = create(<Folha visivel titulo="T" aoFechar={() => undefined} rodape={null}>{null}</Folha>); });
  const painel = raiz.root.find((no) => no.props.role === 'dialog' && typeof no.type !== 'string');
  expect(StyleSheet.flatten(painel.props.style).paddingBottom).toBe(24);
  jest.restoreAllMocks();
});
