import { arranjoDaDieta } from './arranjoDaDieta';

describe('arranjoDaDieta', () => {
  it('sem medida e no celular, o desenho de sempre (empilhado)', () => {
    expect(arranjoDaDieta(null).lado).toBe(false);
    expect(arranjoDaDieta(358).lado).toBe(false);
    expect(arranjoDaDieta(951).lado).toBe(false);
  });

  it('lado a lado a partir de 952 (560 + 32 + 360), com o apoio de 360', () => {
    expect(arranjoDaDieta(952)).toEqual({ lado: true, larguraDoApoio: 360 });
    expect(arranjoDaDieta(1000)).toEqual({ lado: true, larguraDoApoio: 360 });
  });

  it('no teto da tela do aluno (1312) o apoio passa a 400 e a lista fecha em 880', () => {
    expect(arranjoDaDieta(1311).larguraDoApoio).toBe(360);
    const teto = arranjoDaDieta(1312);
    expect(teto).toEqual({ lado: true, larguraDoApoio: 400 });
    expect(1312 - 32 - teto.larguraDoApoio).toBe(880);
  });

  it('a ultralarga segue lado a lado (a área medida da dieta nunca passa do teto; a sobra vira margem)', () => {
    expect(arranjoDaDieta(2600).lado).toBe(true);
    expect(arranjoDaDieta(3440).lado).toBe(true);
  });
});
