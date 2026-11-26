/* eslint-disable @typescript-eslint/no-require-imports */
import { Campo } from './Campo';

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/label', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');
const { ALVO_TOQUE } = require('../tema/tokens') as typeof import('../tema/tokens');

function alturaMinima(linhas: number): number {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(<Campo rotulo="Nome" valor="" aoMudar={() => undefined} linhas={linhas} />);
  });
  const estilo = RN.StyleSheet.flatten(raiz.root.findByType(RN.TextInput).props.style) as { minHeight: number };
  return estilo.minHeight;
}

describe('Campo de várias linhas', () => {
  it('com uma linha não fica abaixo do alvo de toque (a conta dava 42)', () => {
    expect(alturaMinima(1)).toBe(ALVO_TOQUE);
  });

  it('com mais linhas segue a conta das linhas', () => {
    expect(alturaMinima(2)).toBe(64);
    expect(alturaMinima(5)).toBe(130);
  });
});
