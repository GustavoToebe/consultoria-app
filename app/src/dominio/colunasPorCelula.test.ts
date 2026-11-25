// tela larga: revisão (24/11)
import { colunasDoHub, colunasPorCelula } from './colunasPorCelula';

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
  it('teto pela faixa da Tela: 2 na compacta e na normal, 3 na larga, 4 na ultralarga', () => {
    expect(colunasDoHub(990, 'compacta', 24, 7)).toBe(2);
    expect(colunasDoHub(1008, 'normal', 24, 7)).toBe(2); // 1280 com o menu: caberiam 2
    expect(colunasDoHub(1590, 'normal', 24, 7)).toBe(2); // caberiam 4, mas a faixa é normal
    expect(colunasDoHub(1648, 'larga', 24, 7)).toBe(3); // 1920 com o menu
    expect(colunasDoHub(3104, 'ultralarga', 24, 7)).toBe(4); // 3440
  });

  it('grupo com pelo menos 360 px: sem espaço, menos colunas que o teto', () => {
    expect(colunasDoHub(743, 'compacta', 24, 7)).toBe(1); // 2 × 360 + 24 = 744
    expect(colunasDoHub(744, 'compacta', 24, 7)).toBe(2);
    expect(colunasDoHub(1100, 'larga', 24, 7)).toBe(2);
    expect(colunasDoHub(1512, 'ultralarga', 24, 7)).toBe(4); // 4 × 360 + 3 × 24
    expect(colunasDoHub(1511, 'ultralarga', 24, 7)).toBe(3);
  });

  it('celular: 1 coluna; nunca mais colunas que os grupos do perfil', () => {
    expect(colunasDoHub(358, 'compacta', 24, 7)).toBe(1);
    expect(colunasDoHub(0, 'compacta', 24, 7)).toBe(1);
    expect(colunasDoHub(3104, 'ultralarga', 24, 3)).toBe(3);
    expect(colunasDoHub(3104, 'ultralarga', 24, 0)).toBe(1);
  });
});
