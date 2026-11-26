import {
  AREA_MINIMA_LADO_A_LADO, arranjoPrincipalComApoio, LARGURA_DO_APOIO, larguraDoApoioPorArea,
} from './arranjoPrincipalComApoio';

describe('arranjoPrincipalComApoio', () => {
  it('abre lado a lado a partir de 952 (560 + 32 + 360)', () => {
    expect(AREA_MINIMA_LADO_A_LADO).toBe(952);
  });

  it('empilha sem apoio, sem medida ou com medida inválida', () => {
    expect(arranjoPrincipalComApoio(2000, false)).toBe('empilhado');
    expect(arranjoPrincipalComApoio(null, true)).toBe('empilhado');
    expect(arranjoPrincipalComApoio(0, true)).toBe('empilhado');
    expect(arranjoPrincipalComApoio(Number.NaN, true)).toBe('empilhado');
  });

  it('põe lado a lado só quando a principal mantém o mínimo', () => {
    expect(arranjoPrincipalComApoio(AREA_MINIMA_LADO_A_LADO - 1, true)).toBe('empilhado');
    expect(arranjoPrincipalComApoio(AREA_MINIMA_LADO_A_LADO, true)).toBe('lado');
  });

  it('respeita uma largura de apoio própria', () => {
    expect(arranjoPrincipalComApoio(AREA_MINIMA_LADO_A_LADO, true, LARGURA_DO_APOIO + 100)).toBe('empilhado');
    expect(arranjoPrincipalComApoio(AREA_MINIMA_LADO_A_LADO + 100, true, LARGURA_DO_APOIO + 100)).toBe('lado');
  });

  it('o apoio cresce com a faixa: 360, 400 e 440', () => {
    expect(larguraDoApoioPorArea(null)).toBe(360);
    expect(larguraDoApoioPorArea(1311)).toBe(360);
    expect(larguraDoApoioPorArea(1312)).toBe(400);
    expect(larguraDoApoioPorArea(2399)).toBe(400);
    expect(larguraDoApoioPorArea(2400)).toBe(440);
  });
});
