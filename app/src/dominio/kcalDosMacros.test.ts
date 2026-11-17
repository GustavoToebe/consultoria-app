import { kcalDoAlimento, kcalDosMacros } from './kcalDosMacros';

// Paridade com `KcalDosMacrosParidadeTest` (API): os mesmos casos de `kcalDoAlimento`, na mesma ordem.
describe('kcalDoAlimento (D15: macros opcionais)', () => {
  it('com os três macros recalcula, mesmo com kcal gravada', () => {
    expect(kcalDoAlimento(100, 0, 0, 321.5)).toBe(400);
    expect(kcalDoAlimento(2.5, 28.1, 0.2, null)).toBe(124.2);
  });

  it('com um, dois ou nenhum macro mantém a kcal gravada (a da fonte)', () => {
    expect(kcalDoAlimento(10, 20, null, 321.5)).toBe(321.5);
    expect(kcalDoAlimento(10, null, null, 321.5)).toBe(321.5);
    expect(kcalDoAlimento(null, null, null, 321.5)).toBe(321.5);
    expect(kcalDoAlimento(0, null, null, 321.5)).toBe(321.5);
  });

  it('sem macros e sem kcal gravada é nulo, nunca zero', () => {
    expect(kcalDoAlimento(null, null, null, null)).toBeNull();
    expect(kcalDoAlimento(10, null, 1, null)).toBeNull();
  });

  it('0/0/0 digitado de propósito dá 0 e não a kcal gravada', () => {
    expect(kcalDoAlimento(0, 0, 0, 321.5)).toBe(0);
    expect(kcalDoAlimento(0, 0, 0, null)).toBe(0);
  });
});

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
