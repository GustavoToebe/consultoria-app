import { kcalDosMacros } from './kcalDosMacros';

describe('kcalDosMacros', () => {
  it('soma proteína × 4, carboidrato × 4 e gordura × 9', () => {
    expect(kcalDosMacros(100, 0, 0)).toBe(400);
    expect(kcalDosMacros(0, 0, 100)).toBe(900);
    expect(kcalDosMacros(2.5, 28.1, 0.2)).toBe(124.2);
  });

  it('não deixa ruído de ponto flutuante', () => {
    expect(kcalDosMacros(0.9, 12.3, 0.1)).toBe(53.7);
    expect(kcalDosMacros(0.1, 0.2, 0.3)).toBe(3.9);
  });

  it('zero é um valor: tudo zerado dá 0, não nulo', () => {
    expect(kcalDosMacros(0, 0, 0)).toBe(0);
  });

  it('é nulo se qualquer macro for nulo ou NaN', () => {
    expect(kcalDosMacros(null, 10, 1)).toBeNull();
    expect(kcalDosMacros(10, null, 1)).toBeNull();
    expect(kcalDosMacros(10, 10, null)).toBeNull();
    expect(kcalDosMacros(Number.NaN, 10, 1)).toBeNull();
  });

  it('é nulo com macro negativo (a API recusa)', () => {
    expect(kcalDosMacros(-10, 10, 1)).toBeNull();
    expect(kcalDosMacros(10, 10, -0.1)).toBeNull();
  });
});
