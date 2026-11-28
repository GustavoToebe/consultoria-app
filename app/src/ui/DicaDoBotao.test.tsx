/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

import { DicaDoBotao } from './DicaDoBotao';

/**
 * A dica do motivo de um botão desabilitado: sem motivo o botão vai puro; no celular (ou abaixo de 768 px) o motivo vai
 * para o botão, escrito embaixo; na web larga o envoltório focável leva nome, `aria-disabled` e o motivo, e a dica abre no
 * mouse e no foco e fecha no Esc. `useTeclado` trocado por um que guarda o ouvinte (o jest não tem `document`).
 */
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').ESCURO }) }));
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
let mockTeclado: ((t: { key: string }) => unknown) | null = null;
jest.mock('./usoWeb', () => ({
  useTeclado: (ativo: boolean, aoTeclar: (t: { key: string }) => unknown) => { mockTeclado = ativo ? aoTeclar : null; },
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');

let largura = 1280;
jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => ({ width: largura, height: 900, scale: 1, fontScale: 1 }));

const MOTIVO = 'Salve o modelo antes.';
/** O botão de mentira escreve o motivo que recebeu, para o teste ver para onde ele foi. */
const botao = (m: string | undefined) => <RN.Text testID="botao">{m ?? 'sem motivo'}</RN.Text>;

function montar(motivo?: string): ReactTestRenderer {
  let raiz!: ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(<DicaDoBotao rotulo="Aplicar ao aluno" motivo={motivo}>{botao}</DicaDoBotao>);
  });
  return raiz;
}
const envoltorio = (raiz: ReactTestRenderer): ReactTestInstance | undefined => raiz.root.findAll((n) => n.props.role === 'button' && typeof n.type !== 'string')[0];
const textoDoBotao = (raiz: ReactTestRenderer) => raiz.root.findAllByProps({ testID: 'botao' }).filter((n) => typeof n.type !== 'string')[0].props.children;
const dicaAberta = (raiz: ReactTestRenderer) => raiz.root.findAllByProps({ testID: 'dica-do-botao' }).length > 0;

describe('DicaDoBotao', () => {
  const plataforma = RN.Platform.OS;
  afterEach(() => {
    RN.Platform.OS = plataforma;
    largura = 1280;
    mockTeclado = null;
  });

  it('sem motivo, o botão vai puro: sem envoltório focável', () => {
    RN.Platform.OS = 'web';
    const raiz = montar(undefined);
    expect(envoltorio(raiz)).toBeUndefined();
    expect(textoDoBotao(raiz)).toBe('sem motivo');
  });

  it('no celular nativo, o motivo continua escrito sob o botão', () => {
    RN.Platform.OS = 'ios';
    const raiz = montar(MOTIVO);
    expect(envoltorio(raiz)).toBeUndefined();
    expect(textoDoBotao(raiz)).toBe(MOTIVO);
  });

  it('na web abaixo de 768 px também não há dica: o motivo fica no botão', () => {
    RN.Platform.OS = 'web';
    largura = 390;
    const raiz = montar(MOTIVO);
    expect(envoltorio(raiz)).toBeUndefined();
    expect(textoDoBotao(raiz)).toBe(MOTIVO);
  });

  it('na web larga, o envoltório é o botão focável com nome, aria-disabled e o motivo; o botão de dentro sai da leitura', () => {
    RN.Platform.OS = 'web';
    const raiz = montar(MOTIVO);
    const env = envoltorio(raiz)!;
    expect(env.props['aria-label']).toBe('Aplicar ao aluno');
    // Pelas props, `aria-disabled` faria o react-native-web emitir um botão nativo com `disabled` (sai do Tab, WCAG 2.1.1): o
    // atributo vai direto no nó, por ref (o DOM de verdade é conferido em `e2e/editor-cabecalho-unico.spec.ts`, teclado e Esc).
    expect(env.props['aria-disabled']).toBeUndefined();
    expect(env.props.tabIndex).toBe(0);
    expect(env.props.accessibilityHint).toBe(MOTIVO);
    expect(typeof env.props['aria-describedby']).toBe('string');
    expect(textoDoBotao(raiz)).toBe('sem motivo');
    expect(dicaAberta(raiz)).toBe(false);
  });

  it('abre no foco, fecha no blur; abre com o mouse e não com o toque; o Esc dispensa sem tirar o foco', () => {
    RN.Platform.OS = 'web';
    const raiz = montar(MOTIVO);
    const env = () => envoltorio(raiz)!;
    Renderer.act(() => env().props.onFocus());
    expect(dicaAberta(raiz)).toBe(true);
    Renderer.act(() => { mockTeclado?.({ key: 'Escape' }); });
    expect(dicaAberta(raiz)).toBe(false);
    Renderer.act(() => env().props.onBlur());
    Renderer.act(() => env().props.onPointerEnter({ nativeEvent: { pointerType: 'touch' } }));
    expect(dicaAberta(raiz)).toBe(false);
    Renderer.act(() => env().props.onPointerEnter({ nativeEvent: { pointerType: 'mouse' } }));
    expect(dicaAberta(raiz)).toBe(true);
    Renderer.act(() => env().props.onPointerLeave());
    expect(dicaAberta(raiz)).toBe(false);
  });
});
