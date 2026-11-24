import { colunasDosPlanos } from './gradeDosPlanos';

// financeiro em tela larga (23/11)
describe('colunasDosPlanos', () => {
  it('o teto vem da régua: 1, 2, 3 e 4 colunas', () => {
    expect(colunasDosPlanos(390, 8)).toBe(1);
    expect(colunasDosPlanos(800, 8)).toBe(2);
    expect(colunasDosPlanos(1200, 9)).toBe(3);
    expect(colunasDosPlanos(1900, 8)).toBe(4);
  });

  it('com menos planos que o teto, as colunas ficam (sem esticar o cartão)', () => {
    expect(colunasDosPlanos(1900, 1)).toBe(4);
    expect(colunasDosPlanos(1900, 2)).toBe(4);
    expect(colunasDosPlanos(3000, 2)).toBe(6);
  });

  it('sem cartão sozinho na última linha quando dá', () => {
    expect(colunasDosPlanos(1900, 5)).toBe(3);
    expect(colunasDosPlanos(1900, 9)).toBe(3);
    expect(colunasDosPlanos(1200, 4)).toBe(2);
    expect(colunasDosPlanos(800, 3)).toBe(2);
    expect(colunasDosPlanos(1900, 6)).toBe(4);
  });

  // tela larga: revisão (24/11)
  it('5 colunas a partir de 2000 px e 6 a partir de 2400, sem cartão sozinho', () => {
    expect(colunasDosPlanos(1999, 8)).toBe(4);
    expect(colunasDosPlanos(2256, 8)).toBe(5);
    expect(colunasDosPlanos(2256, 9)).toBe(5);
    expect(colunasDosPlanos(2256, 11)).toBe(4);
    expect(colunasDosPlanos(3070, 8)).toBe(6);
    expect(colunasDosPlanos(3070, 7)).toBe(5);
    expect(colunasDosPlanos(3070, 13)).toBe(5);
  });

  it('antes da primeira medida (0 px), uma coluna', () => {
    expect(colunasDosPlanos(0, 3)).toBe(1);
  });
});
