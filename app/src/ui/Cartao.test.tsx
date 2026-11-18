/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Cartao } from './Cartao';

jest.mock('../components/ui/card', () => {
  const { View: V } = require('react-native') as typeof import('react-native');
  return { Card: ({ children }: { children?: ReactNode }) => <V>{children}</V> };
});
jest.mock('./Texto', () => ({ Texto: () => null }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').CLARO, bordas: { bloco: 1, item: 1 }, preferencias: { contraste: 'PADRAO' } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const botao = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
const corpo = (r: ReactTestRenderer) => r.root.findAll((n) => String(n.type) === 'View' && n.props.testID === 'corpo').length;

function montar(props: { recolhivel?: boolean; recolhido?: boolean }) {
  let r!: ReactTestRenderer;
  act(() => { r = create(<Cartao titulo="Observações" {...props}><View testID="corpo" /></Cartao>); });
  return r;
}

it('recolhível nasce fechado', () => {
  const r = montar({ recolhivel: true });
  expect(botao(r).props.accessibilityState).toEqual({ expanded: false });
  expect(corpo(r)).toBe(0);
});

it('recolhido={false} nasce aberto', () => {
  const r = montar({ recolhivel: true, recolhido: false });
  expect(botao(r).props.accessibilityState).toEqual({ expanded: true });
  expect(corpo(r)).toBe(1);
});

it('tocar no título alterna', () => {
  const r = montar({ recolhivel: true });
  act(() => botao(r).props.onPress());
  expect(corpo(r)).toBe(1);
  expect(botao(r).props.accessibilityLabel).toBe('Observações, expandido');
  act(() => botao(r).props.onPress());
  expect(corpo(r)).toBe(0);
});

it('sem recolhivel não há botão e o corpo aparece', () => {
  const r = montar({});
  expect(botao(r)).toBeUndefined();
  expect(corpo(r)).toBe(1);
});
