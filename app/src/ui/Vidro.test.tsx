/* eslint-disable @typescript-eslint/no-require-imports */
import { createRef } from 'react';
import { Platform, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { fundoDoVidro, TOKENS_STNDRD_ESCURO } from '../tema/tokens';
import { useReduzirTransparencia } from './useReduzirTransparencia';
import { Vidro, vidroComBlur } from './Vidro';

// expo-blur é módulo nativo: no Jest, o BlurView vira um View marcado.
jest.mock('expo-blur', () => {
  const { createElement } = require('react') as typeof import('react');
  const { View: V } = require('react-native') as typeof import('react-native');
  return {
    BlurView: (props: object) => createElement(V, { ...props, testID: 'blur' }),
    BlurTargetView: V,
  };
});
const mockContraste = { valor: 'PADRAO' };
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ stndrd: require('../tema/tokens').TOKENS_STNDRD_ESCURO, modo: 'ESCURO', preferencias: { contraste: mockContraste.valor } }),
}));
jest.mock('./useReduzirTransparencia', () => ({ useReduzirTransparencia: jest.fn(() => false) }));

const vidro = TOKENS_STNDRD_ESCURO.glass;

function montar(alvo?: React.RefObject<View | null>): ReactTestRenderer {
  let raiz!: ReactTestRenderer;
  act(() => { raiz = create(<Vidro alvo={alvo} estilo={{ borderTopWidth: 1 }}><View testID="filho" /></Vidro>); });
  return raiz;
}
const fundos = (raiz: ReactTestRenderer) =>
  raiz.root.findAllByType(View).flatMap((v) => [v.props.style].flat(Infinity)).map((s) => s?.backgroundColor).filter(Boolean);

afterEach(() => {
  mockContraste.valor = 'PADRAO';
  jest.mocked(useReduzirTransparencia).mockReturnValue(false);
  jest.restoreAllMocks();
});

describe('vidroComBlur', () => {
  it('iPhone borra sem alvo; "reduzir transparência" sempre tira o blur', () => {
    expect(vidroComBlur({ os: 'ios', versao: '18.0', temAlvo: false, reduzir: false })).toBe(true);
    expect(vidroComBlur({ os: 'ios', versao: '18.0', temAlvo: true, reduzir: true })).toBe(false);
  });
  it('Android só borra com alvo e a partir do 12 (API 31)', () => {
    expect(vidroComBlur({ os: 'android', versao: 31, temAlvo: true, reduzir: false })).toBe(true);
    expect(vidroComBlur({ os: 'android', versao: 30, temAlvo: true, reduzir: false })).toBe(false);
    expect(vidroComBlur({ os: 'android', versao: 34, temAlvo: false, reduzir: false })).toBe(false);
  });
});

describe('Vidro', () => {
  it('com blur: o BlurView atrás e, por cima dele, a cor do vidro na opacidade do token', () => {
    const raiz = montar();
    expect(raiz.root.findAllByProps({ testID: 'blur' }).length).toBeGreaterThan(0);
    expect(fundos(raiz)).toContain(fundoDoVidro(vidro));
    expect(raiz.root.findAllByProps({ testID: 'filho' }).length).toBeGreaterThan(0);
  });

  it('com "reduzir transparência": fundo sólido, sem BlurView', () => {
    jest.mocked(useReduzirTransparencia).mockReturnValue(true);
    const raiz = montar();
    expect(raiz.root.findAllByProps({ testID: 'blur' })).toHaveLength(0);
    expect(fundos(raiz)).toEqual([vidro.cor]);
  });

  it('com contraste alto: fundo sólido', () => {
    mockContraste.valor = 'ALTO';
    expect(montar().root.findAllByProps({ testID: 'blur' })).toHaveLength(0);
  });

  it('no Android sem alvo: fundo sólido, nunca texto sem fundo', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const raiz = montar();
    expect(raiz.root.findAllByProps({ testID: 'blur' })).toHaveLength(0);
    expect(fundos(raiz)).toEqual([vidro.cor]);
  });

  it('no Android com alvo, o ref chega ao BlurView (o blur só liga no aparelho com API 31+)', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(34);
    const alvo = createRef<View>();
    const raiz = montar(alvo);
    const blur = raiz.root.findAllByProps({ testID: 'blur' })[0];
    expect(blur.props.blurTarget).toBe(alvo);
    expect(blur.props.blurMethod).toBe('dimezisBlurViewSdk31Plus');
  });
});
