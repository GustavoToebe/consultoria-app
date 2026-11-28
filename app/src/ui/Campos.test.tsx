/* eslint-disable @typescript-eslint/no-require-imports */
import type { TextInput } from 'react-native';

import { CampoData, CampoNumerico } from './Campos';

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('./Calendario', () => ({ BotaoCalendario: () => null, Calendario: () => null }));
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');
const RN = require('react-native') as typeof import('react-native');

describe('CampoData', () => {
  it('repassa o ref ao campo de texto (o foco vai ao primeiro erro do formulário)', () => {
    const ref = React.createRef<TextInput>();
    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      raiz = Renderer.create(<CampoData ref={ref} rotulo="Primeiro vencimento" valor="" aoMudar={() => undefined} />, {
        createNodeMock: () => ({ focus: jest.fn() }),
      });
    });
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
    expect(raiz.root.findAllByType(RN.TextInput)).toHaveLength(1);
  });

  it('sem ref continua igual (os outros usos)', () => {
    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      raiz = Renderer.create(<CampoData rotulo="Data" valor="31/02/2026" aoMudar={() => undefined} />);
    });
    expect(raiz.root.findAllByType(RN.Text).some((t) => [t.props.children].flat().join('') === 'Data inválida.')).toBe(true);
  });
});

describe('CampoNumerico: altura, mono e centralizado', () => {
  const { fontes } = require('../tema/tokens') as typeof import('../tema/tokens');
  function estilo(props: { altura?: number; mono?: boolean; centralizado?: boolean }) {
    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      raiz = Renderer.create(<CampoNumerico rotulo="Reps" valor={8} aoMudar={() => undefined} inteiro {...props} />);
    });
    return RN.StyleSheet.flatten(raiz.root.findByType(RN.TextInput).props.style) as { height?: number; fontFamily?: string; textAlign?: string };
  }

  it('sem as props fica como antes', () => {
    const e = estilo({});
    expect(e.height).toBeUndefined();
    expect(e.fontFamily).toBe(fontes.normal);
    expect(e.textAlign).toBeUndefined();
  });

  it('repassa a altura, a fonte mono e o texto centralizado ao campo', () => {
    const e = estilo({ altura: 46, mono: true, centralizado: true });
    expect(e.height).toBe(46);
    expect(e.fontFamily).toBe(fontes.monoSemi);
    expect(e.textAlign).toBe('center');
  });
});
