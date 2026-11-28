import { colunasDaGradeDeIndicadores as colunas, linhasDaGrade } from './gradeDeIndicadores';

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
    expect(colunas(1297, 5)).toBe(4); // 4 colunas, mas as linhas equilibradas dão 3 + 2, nunca 4 + 1
    expect(linhasDaGrade(5, colunas(1297, 5))).toEqual([3, 2]);
    expect(colunas(1036, 5)).toBe(4);
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

  it('7 cartões (sem divisor): 7, 4 + 3, 3 + 2 + 2 e 2 + 2 + 2 + 1 (última esticada) ou 1', () => {
    expect(colunas(2000, 7)).toBe(7);
    expect(colunas(1822, 7)).toBe(7); // 7 × 250 + 72
    expect(colunas(1821, 7)).toBe(4);
    expect(colunas(1100, 7)).toBe(4);
    expect(colunas(1036, 7)).toBe(4);
    expect(colunas(1035, 7)).toBe(3); // 4 não cabe
    expect(colunas(900, 7)).toBe(3);
    expect(colunas(774, 7)).toBe(3);
    expect(colunas(773, 7)).toBe(2);
    expect(colunas(511, 7)).toBe(1);
  });

  it('distribuição equilibrada: as linhas diferem em no máximo 1 e as de cima ficam com os que sobram', () => {
    expect(linhasDaGrade(7, 3)).toEqual([3, 2, 2]);
    expect(linhasDaGrade(7, 4)).toEqual([4, 3]);
    expect(linhasDaGrade(5, 3)).toEqual([3, 2]);
    expect(linhasDaGrade(5, 2)).toEqual([2, 2, 1]); // sobra um sozinho, esticado
    // Dieta do aluno (28/11): refeições e seções em 2 colunas, por linha; o ímpar fecha na largura toda.
    expect(linhasDaGrade(1, 2)).toEqual([1]);
    expect(linhasDaGrade(3, 2)).toEqual([2, 1]);
    expect(linhasDaGrade(4, 2)).toEqual([2, 2]);
    expect(linhasDaGrade(7, 2)).toEqual([2, 2, 2, 1]);
    expect(linhasDaGrade(11, 2)).toEqual([2, 2, 2, 2, 2, 1]);
    expect(linhasDaGrade(11, 3)).toEqual([3, 3, 3, 2]);
    expect(linhasDaGrade(11, 4)).toEqual([4, 4, 3]);
    expect(linhasDaGrade(13, 4)).toEqual([4, 3, 3, 3]);
    expect(linhasDaGrade(6, 3)).toEqual([3, 3]); // com divisor: todas cheias
    expect(linhasDaGrade(5, 5)).toEqual([5]);
    expect(linhasDaGrade(5, 9)).toEqual([5]);
    expect(linhasDaGrade(5, 1)).toEqual([1, 1, 1, 1, 1]);
    expect(linhasDaGrade(0, 3)).toEqual([]);
  });

  it('tabela de 5, 7, 11 e 13 cartões nas larguras de quebra', () => {
    const tabela = (total: number, larguras: number[]) =>
      larguras.map((l) => `${l}: ${linhasDaGrade(total, colunas(l, total)).join('+')}`);
    expect(tabela(5, [1298, 1297, 1036, 774, 773, 512, 511])).toEqual([
      '1298: 5', '1297: 3+2', '1036: 3+2', '774: 3+2', '773: 2+2+1', '512: 2+2+1', '511: 1+1+1+1+1',
    ]);
    expect(tabela(7, [1822, 1821, 1036, 1035, 774, 773, 512, 511])).toEqual([
      '1822: 7', '1821: 4+3', '1036: 4+3', '1035: 3+2+2', '774: 3+2+2', '773: 2+2+2+1', '512: 2+2+2+1', '511: 1+1+1+1+1+1+1',
    ]);
    expect(tabela(11, [2000, 1000, 600, 511])).toEqual(['2000: 4+4+3', '1000: 3+3+3+2', '600: 2+2+2+2+2+1', '511: 1+1+1+1+1+1+1+1+1+1+1']);
    expect(tabela(13, [2000, 1300, 1000, 600])).toEqual(['2000: 4+3+3+3', '1300: 4+3+3+3', '1000: 3+3+3+2+2', '600: 2+2+2+2+2+2+1']);
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

  it('em qualquer largura, de 2 a 13 cartões: total com divisor igual à regra de antes; sem divisor, o maior c de 4, 3, 2 que cabe e linhas equilibradas; a célula cabe', () => {
    for (let total = 2; total <= 13; total++) {
      for (const minimo of [180, 211, 250]) {
        for (let l = 200; l <= 3600; l += 1) {
          const c = colunas(l, total, { minimo });
          if (c > 1) expect(cabe(l, c, minimo)).toBe(true);
          const linhas = linhasDaGrade(total, c);
          expect(linhas.reduce((s, k) => s + k, 0)).toBe(total);
          if (!ehPrimo(total) || total < 5) {
            expect(c).toBe(colunasAte24_11(l, total, minimo));
            expect(new Set(linhas).size).toBe(1); // todas as linhas cheias
            continue;
          }
          // Primo a partir de 5: linhas que diferem em no máximo 1, as de cima com os que sobram, nenhuma passa de c.
          expect(Math.max(...linhas) - Math.min(...linhas)).toBeLessThanOrEqual(1);
          expect([...linhas].sort((a, b) => b - a)).toEqual(linhas);
          expect(Math.max(...linhas)).toBeLessThanOrEqual(Math.max(c, 1));
          // Todos numa linha, ou o maior de 4, 3 e 2 que cabe (nunca pula um que cabe).
          if (c !== total) for (const r of [4, 3, 2]) if (r > c && r < total) expect(cabe(l, r, minimo)).toBe(false);
          // 1 coluna só quando nem 2 cabem.
          if (c === 1) expect(cabe(l, 2, minimo)).toBe(false);
          // Cartão sozinho na última linha só em 2 colunas.
          if (linhas[linhas.length - 1] === 1 && linhas.length > 1) expect(c).toBeLessThanOrEqual(2);
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
