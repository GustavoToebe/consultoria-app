import { colunasPorLargura } from './grade';

describe('colunasPorLargura', () => {
  it('1 coluna abaixo de 760 px (inclui a largura ainda não medida)', () => {
    expect(colunasPorLargura(0)).toBe(1);
    expect(colunasPorLargura(360)).toBe(1);
    expect(colunasPorLargura(759)).toBe(1);
  });
  it('2 colunas de 760 a 1239 px', () => {
    expect(colunasPorLargura(760)).toBe(2);
    expect(colunasPorLargura(1000)).toBe(2);
    expect(colunasPorLargura(1239)).toBe(2);
  });
  it('3 colunas a partir de 1240 px', () => {
    expect(colunasPorLargura(1240)).toBe(3);
    expect(colunasPorLargura(1800)).toBe(3);
  });
});
