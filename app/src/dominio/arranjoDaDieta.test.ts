import { arranjoDaDieta } from './arranjoDaDieta';

describe('arranjoDaDieta', () => {
  it('sem medida e no celular, o desenho de sempre (empilhado)', () => {
    expect(arranjoDaDieta(null).lado).toBe(false);
    expect(arranjoDaDieta(358).lado).toBe(false);
    expect(arranjoDaDieta(971).lado).toBe(false);
  });

  it('lado a lado a partir de 972 (560 + 32 + 380), com o apoio de 380', () => {
    expect(arranjoDaDieta(972)).toEqual({ lado: true, larguraDoApoio: 380 });
    expect(arranjoDaDieta(1000)).toEqual({ lado: true, larguraDoApoio: 380 });
  });

  it('o apoio segue as faixas: 420 da larga (1600) e 440 da ultralarga (2400)', () => {
    expect(arranjoDaDieta(1599).larguraDoApoio).toBe(380);
    expect(arranjoDaDieta(1600)).toEqual({ lado: true, larguraDoApoio: 420 });
    expect(arranjoDaDieta(2400)).toEqual({ lado: true, larguraDoApoio: 440 });
  });

  it('a ultralarga segue lado a lado', () => {
    expect(arranjoDaDieta(2600).lado).toBe(true);
    expect(arranjoDaDieta(3440).lado).toBe(true);
  });
});
