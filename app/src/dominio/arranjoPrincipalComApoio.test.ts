import {
  AREA_MINIMA_LADO_A_LADO, apoioGruda, arranjoPrincipalComApoio, LARGURA_DO_APOIO, larguraDoApoioDaFaixa, larguraDoApoioPorArea,
} from './arranjoPrincipalComApoio';

describe('arranjoPrincipalComApoio', () => {
  it('abre lado a lado a partir de 972 (560 + 32 + 380)', () => {
    expect(AREA_MINIMA_LADO_A_LADO).toBe(972);
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

  it('o apoio segue as faixas da Tela (as do treinador): 380, 420 e 440', () => {
    expect((['compacta', 'normal', 'larga', 'ultralarga'] as const).map(larguraDoApoioDaFaixa)).toEqual([380, 380, 420, 440]);
    expect(larguraDoApoioPorArea(null)).toBe(380);
    expect(larguraDoApoioPorArea(1599)).toBe(380);
    expect(larguraDoApoioPorArea(1600)).toBe(420);
    expect(larguraDoApoioPorArea(2399)).toBe(420);
    expect(larguraDoApoioPorArea(2400)).toBe(440);
  });

  it('a coluna que gruda só se couber: gruda até a altura disponível', () => {
    expect(apoioGruda(0, 900)).toBe(true);
    expect(apoioGruda(900, 900)).toBe(true);
    expect(apoioGruda(901, 900)).toBe(false);
  });
});
