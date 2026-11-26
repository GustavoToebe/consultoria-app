/* eslint-disable @typescript-eslint/no-require-imports */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Escolha } from './Escolha';

// Os primitivos `@rn-primitives` vêm em JSX sem transformação no jest: o grupo falso repete o contrato (toggle de valor único; o teclado, que é da web, está em `e2e/escolha-teclado.spec.ts`).
jest.mock('../components/ui/toggle-group', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  const Contexto = React.createContext(null);
  return {
    ToggleGroup: ({ value, onValueChange, children }: { value?: string; onValueChange: (v?: string) => void; children?: unknown }) => React.createElement(Contexto.Provider, { value: { value, onValueChange } }, React.createElement(View, null, children)),
    ToggleGroupItem: ({ value, disabled, accessibilityLabel, children }: { value: string; disabled?: boolean; accessibilityLabel?: string; children?: unknown }) => {
      const c = React.useContext(Contexto);
      return React.createElement(Pressable, { accessibilityLabel, disabled, onPress: () => c.onValueChange(c.value === value ? undefined : value) }, children);
    },
  };
});
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('./Texto', () => ({ Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('./Campo', () => ({ useAnunciarErro: () => undefined, MensagemDeErro: () => null }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }) }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

const OPCOES = [{ valor: 'a', rotulo: 'A' }, { valor: 'b', rotulo: 'B' }];

function montar(valor: string | null, extra: { limpavel?: boolean } = {}) {
  const aoMudar = jest.fn();
  let r!: ReactTestRenderer;
  act(() => { r = create(<Escolha opcoes={OPCOES} valor={valor} aoMudar={aoMudar} descricao="Letra" {...extra} />); });
  const toca = (rotulo: string) => act(() => { r.root.find((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function').props.onPress(); });
  return { aoMudar, toca };
}

it('escolher outra opção chama aoMudar com o valor dela', () => {
  const { aoMudar, toca } = montar('a');
  toca('B');
  expect(aoMudar).toHaveBeenCalledWith('b');
});

it('opção ativa: limpável devolve null; sem limpável não muda', () => {
  const limpavel = montar('a', { limpavel: true });
  limpavel.toca('A');
  expect(limpavel.aoMudar).toHaveBeenCalledWith(null);
  const fixa = montar('a');
  fixa.toca('A');
  expect(fixa.aoMudar).not.toHaveBeenCalled();
});
