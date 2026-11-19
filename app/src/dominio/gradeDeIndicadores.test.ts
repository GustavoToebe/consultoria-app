import { colunasDaGradeDeIndicadores as colunas } from './gradeDeIndicadores';

describe('colunas da grade de indicadores', () => {
  it('6 cartões: 6 numa linha, 3 + 3, 2 por linha ou 1, nunca 5 + 1 nem 4 + 2', () => {
    expect(colunas(1648, 6)).toBe(6); // 1920 de janela com o menu aberto
    expect(colunas(1560, 6)).toBe(6);
    expect(colunas(1559, 6)).toBe(3);
    expect(colunas(1328, 6)).toBe(3); // 1600 de janela
    expect(colunas(1008, 6)).toBe(3); // 1280 de janela
    expect(colunas(774, 6)).toBe(3);
    expect(colunas(752, 6)).toBe(2); // 1024 de janela: três de 242 px cortariam "R$ 100.000,00"
    expect(colunas(512, 6)).toBe(2);
    expect(colunas(358, 6)).toBe(1); // 390 de celular
    for (let l = 300; l <= 2000; l += 7) expect([1, 2, 3, 6]).toContain(colunas(l, 6));
  });

  it('4 cartões: 4, 2 + 2 ou 1, nunca 3 + 1', () => {
    expect(colunas(1036, 4)).toBe(4);
    expect(colunas(1035, 4)).toBe(2);
    expect(colunas(512, 4)).toBe(2);
    expect(colunas(511, 4)).toBe(1);
    for (let l = 300; l <= 2000; l += 7) expect([1, 2, 4]).toContain(colunas(l, 4));
    // Com o mínimo dos Interessados e do Resultado do mês (~211 px): 4 a partir de 880, como hoje.
    expect(colunas(880, 4, { minimo: 211 })).toBe(4);
    expect(colunas(879, 4, { minimo: 211 })).toBe(2);
  });

  it('total que não divide: a quebra mais equilibrada, sem cartão sozinho (5 em 3 + 2, 7 em 4 + 3, 8 em 4 ou 3 + 3 + 2)', () => {
    expect(colunas(1300, 5)).toBe(5);
    expect(colunas(1000, 5)).toBe(3);
    expect(colunas(600, 5)).toBe(1);
    expect(colunas(1100, 7)).toBe(4);
    expect(colunas(1100, 8)).toBe(4);
    expect(colunas(800, 8)).toBe(3);
  });

  it('texto ampliado aumenta a célula mínima; sem medida, um ou zero cartões, uma coluna', () => {
    expect(colunas(1648, 6, { fatorTexto: 1.3 })).toBe(3);
    expect(colunas(0, 6)).toBe(1);
    expect(colunas(1600, 1)).toBe(1);
    expect(colunas(1600, 0)).toBe(1);
  });
});
