import { AccessibilityInfo, Platform, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useReduzirTransparencia } from './useReduzirTransparencia';

function Sonda() {
  return <Text>{String(useReduzirTransparencia())}</Text>;
}
let raiz: ReactTestRenderer;
const valor = () => raiz.root.findByType(Text).props.children === 'true';
async function montar() {
  await act(async () => { raiz = create(<Sonda />); });
  return raiz;
}

afterEach(() => jest.restoreAllMocks());

describe('useReduzirTransparencia', () => {
  it('iPhone: lê a preferência e acompanha a mudança', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    let avisar: (v: boolean) => void = () => undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_evento: string, f: (v: boolean) => void) => {
      avisar = f;
      return { remove };
    }) as never);
    await montar();
    expect(valor()).toBe(true);
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith('reduceTransparencyChanged', expect.any(Function));
    act(() => avisar(false));
    expect(valor()).toBe(false);
    act(() => raiz.unmount());
    expect(remove).toHaveBeenCalled();
  });

  it('Android: a preferência não existe no React Native, fica falso sem perguntar', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    // A espia do caso anterior pode sobrar no objeto: zera a contagem.
    const pergunta = jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled');
    pergunta.mockClear();
    await montar();
    expect(valor()).toBe(false);
    expect(pergunta).not.toHaveBeenCalled();
  });

  it('web: segue prefers-reduced-transparency e para de ouvir ao desmontar', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    let aoMudar: ((e: { matches: boolean }) => void) | undefined;
    const removeEventListener = jest.fn();
    const matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: (_e: string, f: (e: { matches: boolean }) => void) => { aoMudar = f; },
      removeEventListener,
    }));
    Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true, writable: true });
    await montar();
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-transparency: reduce)');
    expect(valor()).toBe(true);
    act(() => aoMudar?.({ matches: false }));
    expect(valor()).toBe(false);
    act(() => raiz.unmount());
    expect(removeEventListener).toHaveBeenCalled();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('web sem matchMedia (ou com erro): falso, sem quebrar', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    Object.defineProperty(window, 'matchMedia', { value: () => { throw new Error('sem suporte'); }, configurable: true, writable: true });
    await montar();
    expect(valor()).toBe(false);
    Reflect.deleteProperty(window, 'matchMedia');
  });
});
