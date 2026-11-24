import { colunasDaGradeDeIndicadores as colunas } from './gradeDeIndicadores';

/** Nenhuma linha incompleta: a última linha tem tantos cartões quanto as outras (ou é uma coluna só). */
const linhasCheias = (total: number, c: number) => c === 1 || total % c === 0;

describe('colunas da grade de indicadores', () => {
  it('2 cartões: 2 ou 1', () => {
    expect(colunas(1600, 2)).toBe(2);
    expect(colunas(512, 2)).toBe(2); // 2 × 250 + 12
    expect(colunas(511, 2)).toBe(1);
    expect(colunas(434, 2, { minimo: 211 })).toBe(2);
    expect(colunas(433, 2, { minimo: 211 })).toBe(1);
  });

  it('3 cartões: 3 ou 1, nunca 2 + 1', () => {
    expect(colunas(3000, 3)).toBe(3);
    expect(colunas(774, 3)).toBe(3); // 3 × 250 + 24
    expect(colunas(773, 3)).toBe(1);
    expect(colunas(657, 3, { minimo: 211 })).toBe(3);
    expect(colunas(656, 3, { minimo: 211 })).toBe(1);
  });

  it('4 cartões: 4, 2 + 2 ou 1, nunca 3 + 1 (também em ultrawide)', () => {
    expect(colunas(3046, 4, { minimo: 211 })).toBe(4); // Cobranças › Totais em 3440 com o menu aberto
    expect(colunas(1036, 4)).toBe(4);
    expect(colunas(1035, 4)).toBe(2);
    expect(colunas(512, 4)).toBe(2);
    expect(colunas(511, 4)).toBe(1);
    // Com o mínimo dos Totais, do Resultado do mês e dos Números (211 px): 4 a partir de 880.
    expect(colunas(1000, 4, { minimo: 211 })).toBe(4);
    expect(colunas(880, 4, { minimo: 211 })).toBe(4);
    expect(colunas(879, 4, { minimo: 211 })).toBe(2);
    expect(colunas(434, 4, { minimo: 211 })).toBe(2);
    expect(colunas(433, 4, { minimo: 211 })).toBe(1);
  });

  it('5 cartões (sem divisão sem sobra): 5 numa linha ou 1 coluna, nunca 3 + 2 nem 4 + 1', () => {
    expect(colunas(3000, 5)).toBe(5);
    expect(colunas(1298, 5)).toBe(5); // 5 × 250 + 48
    expect(colunas(1297, 5)).toBe(1);
    expect(colunas(1000, 5)).toBe(1);
    expect(colunas(600, 5)).toBe(1);
  });

  it('6 cartões: 6, 3 + 3, 2 + 2 + 2 ou 1, nunca 5 + 1 nem 4 + 2', () => {
    expect(colunas(1648, 6)).toBe(6); // 1920 de janela com o menu aberto
    expect(colunas(1560, 6)).toBe(6);
    expect(colunas(1559, 6)).toBe(3);
    expect(colunas(1008, 6)).toBe(3); // 1280 de janela
    expect(colunas(774, 6)).toBe(3);
    expect(colunas(773, 6)).toBe(2); // três de 249 px cortariam "R$ 100.000,00"
    expect(colunas(512, 6)).toBe(2);
    expect(colunas(511, 6)).toBe(1);
    expect(colunas(358, 6)).toBe(1); // 390 de celular
  });

  it('7 e 8: 7 ou 1; 8, 4, 2 ou 1 (nunca 4 + 3 nem 3 + 3 + 2)', () => {
    expect(colunas(2000, 7)).toBe(7);
    expect(colunas(1100, 7)).toBe(1);
    expect(colunas(2096, 8)).toBe(8);
    expect(colunas(1100, 8)).toBe(4);
    expect(colunas(800, 8)).toBe(2);
  });

  it('em qualquer largura, de 2 a 8 cartões: nunca cartão sozinho nem linha com buraco, e a célula cabe', () => {
    for (let total = 2; total <= 8; total++) {
      for (const minimo of [180, 211, 250]) {
        for (let l = 200; l <= 3600; l += 1) {
          const c = colunas(l, total, { minimo });
          expect(linhasCheias(total, c)).toBe(true);
          if (c > 1) expect((l - 12 * (c - 1)) / c).toBeGreaterThanOrEqual(minimo);
        }
      }
    }
  });

  it('texto ampliado aumenta a célula mínima; sem medida, um ou zero cartões, uma coluna', () => {
    expect(colunas(1648, 6, { fatorTexto: 1.3 })).toBe(3);
    expect(colunas(0, 6)).toBe(1);
    expect(colunas(1600, 1)).toBe(1);
    expect(colunas(1600, 0)).toBe(1);
  });
});
