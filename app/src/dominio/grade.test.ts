import { colunasDosIndicadores, colunasPorLargura, duasColunasCom } from './grade';

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

describe('colunasDosIndicadores', () => {
  it('4, 2 ou 1 coluna, nunca 3', () => {
    expect(colunasDosIndicadores(0)).toBe(1);
    expect(colunasDosIndicadores(358)).toBe(1);
    expect(colunasDosIndicadores(480)).toBe(2);
    expect(colunasDosIndicadores(879)).toBe(2);
    expect(colunasDosIndicadores(880)).toBe(4);
    expect(colunasDosIndicadores(1600)).toBe(4);
    for (let l = 0; l <= 2000; l += 10) expect(colunasDosIndicadores(l, 1.4)).not.toBe(3);
  });
  it('texto ampliado tira colunas antes de espremer os rótulos', () => {
    expect(colunasDosIndicadores(1000, 1)).toBe(4);
    expect(colunasDosIndicadores(1000, 1.4)).toBe(2);
    expect(colunasDosIndicadores(600, 1.4)).toBe(1);
  });
});

describe('duasColunasCom', () => {
  it('duas só quando cada uma tem o mínimo', () => {
    const colunas = duasColunasCom(360, 24);
    expect(colunas(743)).toBe(1);
    expect(colunas(744)).toBe(2);
  });
});
