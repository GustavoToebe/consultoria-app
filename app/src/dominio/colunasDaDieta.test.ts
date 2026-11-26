import { larguraDoTotalNaColuna, LINHA_DAS_TRES_COLUNAS, LINHA_DO_TOTAL_ULTRALARGO } from './colunasDaDieta';

describe('larguraDoTotalNaColuna', () => {
  it('limites saem das faixas de 4.10 menos o recuo (16 até a larga, 48 na ultralarga)', () => {
    expect(LINHA_DAS_TRES_COLUNAS).toBe(1568);
    expect(LINHA_DO_TOTAL_ULTRALARGO).toBe(2304);
  });

  it('abaixo da larga, sem medida ou medida inválida: total em faixa cheia acima', () => {
    for (const l of [null, undefined, 0, Number.NaN, -1, 990, 1567]) expect(larguraDoTotalNaColuna(l)).toBeNull();
  });

  it('larga: 400 px (1920 e 2560 com o menu aberto, Limitada em qualquer largura)', () => {
    expect(larguraDoTotalNaColuna(1568)).toBe(400);
    expect(larguraDoTotalNaColuna(1800)).toBe(400);
    expect(larguraDoTotalNaColuna(2303)).toBe(400);
  });

  it('ultralarga: 460 px', () => {
    expect(larguraDoTotalNaColuna(2304)).toBe(460);
    expect(larguraDoTotalNaColuna(3096)).toBe(460);
  });
});
