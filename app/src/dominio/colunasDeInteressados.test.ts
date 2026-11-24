import { analisesEmUmaLinha, colunasDoGlossario, colunasDosOitoIndicadores } from './colunasDeInteressados';

// tela larga: revisão (24/11)
describe('colunasDosOitoIndicadores', () => {
  it('oito numa linha só a partir de ~1840 px de grade; abaixo, 4, 2 ou 1 como antes', () => {
    expect(colunasDosOitoIndicadores(0)).toBe(1);
    expect(colunasDosOitoIndicadores(600)).toBe(2);
    expect(colunasDosOitoIndicadores(1650)).toBe(4);
    expect(colunasDosOitoIndicadores(1839)).toBe(4);
    expect(colunasDosOitoIndicadores(1840)).toBe(8);
    expect(colunasDosOitoIndicadores(3000)).toBe(8);
  });
  it('nunca 3 nem 5 a 7 (sempre linhas cheias de oito cartões)', () => {
    for (let l = 0; l <= 4000; l += 10) for (const f of [1, 1.2, 1.4]) expect([1, 2, 4, 8]).toContain(colunasDosOitoIndicadores(l, f));
  });
  it('texto ampliado só abre as oito colunas com mais espaço', () => {
    expect(colunasDosOitoIndicadores(2000, 1.4)).toBe(4);
    expect(colunasDosOitoIndicadores(2600, 1.4)).toBe(8);
  });
});

describe('analisesEmUmaLinha', () => {
  it('as quatro análises numa linha só a partir de 2448 px (1920 e 2560 com o menu aberto ficam como antes)', () => {
    expect(analisesEmUmaLinha(1650)).toBe(false);
    expect(analisesEmUmaLinha(2288)).toBe(false);
    expect(analisesEmUmaLinha(2447)).toBe(false);
    expect(analisesEmUmaLinha(2448)).toBe(true);
    expect(analisesEmUmaLinha(3104)).toBe(true);
  });
});

describe('colunasDoGlossario', () => {
  it('1 a 4 colunas pela largura do cartão', () => {
    expect(colunasDoGlossario(400)).toBe(1);
    expect(colunasDoGlossario(544)).toBe(2);
    expect(colunasDoGlossario(1199)).toBe(2);
    expect(colunasDoGlossario(1200)).toBe(3);
    expect(colunasDoGlossario(2000)).toBe(4);
  });
});
