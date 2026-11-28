/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

import { Input } from '../components/ui/input';
import { CampoDeChave } from './CampoDeChave';

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
const React = require('react') as typeof import('react');
const RN = require('react-native') as typeof import('react-native');

type Ouvinte = (e: { type: string; inputType?: string }) => void;

/** O `<input>` de mentira: guarda os ouvintes e o estilo, como o da web. */
function entradaFalsa() {
  const ouvintes = new Map<string, Ouvinte[]>();
  const estilo = new Map<string, string>();
  return {
    value: '',
    ouvintes, estilo,
    focus: jest.fn(),
    addEventListener: (t: string, f: Ouvinte) => { ouvintes.set(t, [...(ouvintes.get(t) ?? []), f]); },
    removeEventListener: (t: string, f: Ouvinte) => { ouvintes.set(t, (ouvintes.get(t) ?? []).filter((g) => g !== f)); },
    style: { setProperty: (n: string, v: string) => { estilo.set(n, v); } },
    disparar(tipo: string, inputType?: string) { for (const f of ouvintes.get(tipo) ?? []) f({ type: tipo, inputType }); },
  };
}

function montar(aoMudar: (t: string) => void, entrada = entradaFalsa()) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(
      <CampoDeChave id="chave-infinitepay" rotulo="API Key" valor="" aoMudar={aoMudar} />,
    );
  });
  // O `<input>` da web chega pelo ref, como no react-native-web (o `TextInput` do Jest não é o elemento do DOM).
  const ref = raiz.root.findByType(Input).props.ref as (no: unknown) => void;
  Renderer.act(() => { ref(entrada); });
  return { raiz, entrada, campo: () => raiz.root.findByType(RN.TextInput) };
}

afterEach(() => { jest.restoreAllMocks(); });

describe('CampoDeChave na web', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'web'); });

  it('pede ao navegador e aos gerenciadores para não preencher, com id neutro, e não é campo de senha', () => {
    const { campo } = montar(() => undefined);
    const p = campo().props as Record<string, unknown>;
    expect(p.autoComplete).toBe('off');
    expect(p.nativeID).toBe('chave-infinitepay');
    expect(p.dataSet).toEqual(expect.objectContaining({ '1pIgnore': 'true', lpignore: 'true', formType: 'other' }));
    expect(p.secureTextEntry).toBeFalsy();
  });

  it('começa vazio, mesmo que o navegador tenha posto um valor antes de o campo ligar', () => {
    const entrada = entradaFalsa();
    entrada.value = 'valor-que-o-navegador-pos';
    const { campo } = montar(() => undefined, entrada);
    expect(campo().props.value).toBe('');
    expect(entrada.value).toBe('');
  });

  it('mudança sem evento de digitação ou colar (preenchimento automático) NÃO chega a quem usa', () => {
    const aoMudar = jest.fn();
    const { campo } = montar(aoMudar);
    Renderer.act(() => { campo().props.onChangeText('valor-automatico'); });
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('digitar e colar chegam; o sinal vale para uma mudança só', () => {
    const aoMudar = jest.fn();
    const { campo, entrada } = montar(aoMudar);
    Renderer.act(() => {
      entrada.disparar('beforeinput', 'insertText');
      campo().props.onChangeText('a');
    });
    Renderer.act(() => {
      entrada.disparar('paste');
      campo().props.onChangeText('a-colado');
    });
    Renderer.act(() => { campo().props.onChangeText('a-colado-e-automatico'); });
    expect(aoMudar.mock.calls).toEqual([['a'], ['a-colado']]);
  });

  it('a troca feita pelo navegador (insertReplacementText) é ignorada', () => {
    const aoMudar = jest.fn();
    const { campo, entrada } = montar(aoMudar);
    Renderer.act(() => {
      entrada.disparar('beforeinput', 'insertReplacementText');
      campo().props.onChangeText('trocado');
    });
    expect(aoMudar).not.toHaveBeenCalled();
  });
});

describe('CampoDeChave fora da web', () => {
  it('mascara pelo sistema, com o olho que mostra, e sem autopreenchimento', () => {
    const { raiz, campo } = montar(() => undefined);
    expect(campo().props.secureTextEntry).toBe(true);
    expect(campo().props.importantForAutofill).toBe('no');
    expect(campo().props.textContentType).toBe('none');
    const olho = raiz.root.findAll((n) => n.props.accessibilityLabel === 'Mostrar API Key' && typeof n.props.onPress === 'function')[0];
    Renderer.act(() => { olho.props.onPress(); });
    expect(campo().props.secureTextEntry).toBe(false);
  });

  it('cada mudança chega a quem usa', () => {
    const aoMudar = jest.fn();
    const { campo } = montar(aoMudar);
    Renderer.act(() => { campo().props.onChangeText('abc'); });
    expect(aoMudar).toHaveBeenCalledWith('abc');
  });
});

void React;
