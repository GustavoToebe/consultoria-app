// tela larga: revisão (24/11)
import { colunasPorCelula } from './colunasPorCelula';

describe('colunasPorCelula', () => {
  it('cabe quantas células de pelo menos o mínimo, de 1 ao máximo', () => {
    expect(colunasPorCelula(0, 560, 16)).toBe(1);
    expect(colunasPorCelula(950, 560, 16)).toBe(1);
    expect(colunasPorCelula(1136, 560, 16)).toBe(2);
    expect(colunasPorCelula(1616, 560, 16)).toBe(2);
    expect(colunasPorCelula(2250, 560, 16)).toBe(3);
    expect(colunasPorCelula(3130, 560, 16)).toBe(4);
    expect(colunasPorCelula(9000, 560, 16)).toBe(4);
    expect(colunasPorCelula(9000, 560, 16, 6)).toBe(6);
  });
});
