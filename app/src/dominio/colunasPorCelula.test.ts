// tela larga: revisão (24/11)
import { colunasDoHub, colunasPorCelula, larguraDoHub } from './colunasPorCelula';

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

describe('colunasDoHub', () => {
  it('1280 e 1920 continuam em 2 colunas de 1040 px', () => {
    expect(larguraDoHub(2)).toBe(1040);
    expect(colunasDoHub(1000, 7)).toBe(2);
    expect(colunasDoHub(1624, 7)).toBe(2); // 3 caberiam, mas 7 = 3 + 3 + 1: volta a 2
  });

  it('ganha colunas com o espaço, sem cartão sozinho na última linha', () => {
    expect(colunasDoHub(2288, 7)).toBe(4); // 4 + 3
    expect(colunasDoHub(3104, 7)).toBe(4);
    expect(colunasDoHub(3104, 5)).toBe(3); // 4 deixaria 4 + 1
    expect(colunasDoHub(3104, 6)).toBe(4);
  });

  it('não passa do número de grupos e nunca tem menos de 2 colunas no PC', () => {
    expect(colunasDoHub(3104, 3)).toBe(3);
    expect(colunasDoHub(3104, 2)).toBe(2);
    expect(colunasDoHub(3104, 1)).toBe(2);
  });

  it('celular: 1 coluna', () => {
    expect(colunasDoHub(358, 7)).toBe(1);
    expect(colunasDoHub(0, 7)).toBe(1);
  });
});
