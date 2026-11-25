import { colunasDaGradeDeIndicadores as colunas } from './gradeDeIndicadores';

/** A regra até 24/11 (só divisores exatos, senão 1 coluna): os totais com divisor têm de continuar iguais a ela. */
function colunasAte24_11(largura: number, total: number, minimo: number): number {
  if (!(largura > 0) || total <= 1) return 1;
  for (let c = total; c > 1; c--) {
    if (total % c !== 0) continue;
    if ((largura - 12 * (c - 1)) / c >= minimo) return c;
  }
  return 1;
}

const ehPrimo = (n: number) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);
const cabe = (l: number, c: number, minimo: number) => (l - 12 * (c - 1)) / c >= minimo;

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
    expect(colunas(600, 3)).toBe(1);
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

  it('5 cartões (sem divisor): 5 numa linha, 3 + 2, 2 + 2 + 1 (última esticada) ou 1; nunca 4 + 1', () => {
    expect(colunas(3000, 5)).toBe(5);
    expect(colunas(1298, 5)).toBe(5); // 5 × 250 + 48
    expect(colunas(1297, 5)).toBe(3); // 4 caberia, mas daria 4 + 1
    expect(colunas(1036, 5)).toBe(3);
    expect(colunas(1000, 5)).toBe(3);
    expect(colunas(774, 5)).toBe(3);
    expect(colunas(773, 5)).toBe(2);
    expect(colunas(512, 5)).toBe(2);
    expect(colunas(511, 5)).toBe(1);
    expect(colunas(358, 5)).toBe(1); // 390 de celular
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

  it('7 cartões (sem divisor): 7, 4 + 3, 3 + 3 + 1 e 2 + 2 + 2 + 1 (última esticada) ou 1', () => {
    expect(colunas(2000, 7)).toBe(7);
    expect(colunas(1822, 7)).toBe(7); // 7 × 250 + 72
    expect(colunas(1821, 7)).toBe(4);
    expect(colunas(1100, 7)).toBe(4);
    expect(colunas(1036, 7)).toBe(4);
    expect(colunas(1035, 7)).toBe(3); // 4 não cabe; sobra um, esticado
    expect(colunas(774, 7)).toBe(3);
    expect(colunas(773, 7)).toBe(2);
    expect(colunas(511, 7)).toBe(1);
  });

  it('8 a 12: divisores exatos como antes; 11 (sem divisor) em 4 + 4 + 3 ou 3 + 3 + 3 + 2', () => {
    expect(colunas(2096, 8)).toBe(8);
    expect(colunas(1100, 8)).toBe(4);
    expect(colunas(800, 8)).toBe(2);
    expect(colunas(2000, 9)).toBe(3);
    expect(colunas(700, 9)).toBe(1); // 9 não tem 2 + 2 + 2 + 2 + 1
    expect(colunas(1300, 10)).toBe(5);
    expect(colunas(1000, 10)).toBe(2);
    expect(colunas(2000, 11)).toBe(4);
    expect(colunas(1000, 11)).toBe(3);
    expect(colunas(600, 11)).toBe(2);
    expect(colunas(1600, 12)).toBe(6);
    expect(colunas(1100, 12)).toBe(4);
    expect(colunas(800, 12)).toBe(3);
  });

  it('em qualquer largura, de 2 a 12 cartões: total com divisor igual à regra de antes; sem divisor, última linha esticada só quando não sai cheia; a célula cabe', () => {
    for (let total = 2; total <= 12; total++) {
      for (const minimo of [180, 211, 250]) {
        for (let l = 200; l <= 3600; l += 1) {
          const c = colunas(l, total, { minimo });
          if (c > 1) expect(cabe(l, c, minimo)).toBe(true);
          const resto = total % c;
          if (!ehPrimo(total) || total < 5) {
            expect(c).toBe(colunasAte24_11(l, total, minimo));
            expect(resto).toBe(0);
            continue;
          }
          // Primo a partir de 5: linha cheia, ou linhas de 4, 3 ou 2 com a última (esticada) mais curta.
          if (resto) expect([2, 3, 4]).toContain(c);
          // Um só na última linha (esticado) só quando nenhuma largura com 2 ou mais na última cabia.
          if (resto === 1) for (const r of [2, 3, 4]) if (r > c && r < total && total % r !== 1) expect(cabe(l, r, minimo)).toBe(false);
          // 1 coluna só quando nem 2 cabem.
          if (c === 1) expect(cabe(l, 2, minimo)).toBe(false);
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
