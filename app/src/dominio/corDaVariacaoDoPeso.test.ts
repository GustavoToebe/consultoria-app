import { tomDaVariacaoDoPeso } from './corDaVariacaoDoPeso';

describe('cor da variação do peso', () => {
  it('REDUZIR: queda é positiva e aumento é problema', () => {
    expect(tomDaVariacaoDoPeso(-0.7, 'REDUZIR')).toBe('positivo');
    expect(tomDaVariacaoDoPeso(1.2, 'REDUZIR')).toBe('problema');
  });

  it('AUMENTAR: o contrário', () => {
    expect(tomDaVariacaoDoPeso(1.2, 'AUMENTAR')).toBe('positivo');
    expect(tomDaVariacaoDoPeso(-0.7, 'AUMENTAR')).toBe('problema');
  });

  it('SEM_META e meta ausente ficam neutros', () => {
    expect(tomDaVariacaoDoPeso(1.2, 'SEM_META')).toBe('neutro');
    expect(tomDaVariacaoDoPeso(-1.2, 'SEM_META')).toBe('neutro');
    expect(tomDaVariacaoDoPeso(1.2, undefined)).toBe('neutro');
    expect(tomDaVariacaoDoPeso(-1.2, null)).toBe('neutro');
  });

  it('variação zero, arredondada a zero, nula ou inválida fica neutra em qualquer meta', () => {
    for (const meta of ['REDUZIR', 'AUMENTAR', 'SEM_META'] as const) {
      expect(tomDaVariacaoDoPeso(0, meta)).toBe('neutro');
      expect(tomDaVariacaoDoPeso(0.004, meta)).toBe('neutro');
      expect(tomDaVariacaoDoPeso(null, meta)).toBe('neutro');
      expect(tomDaVariacaoDoPeso(undefined, meta)).toBe('neutro');
      expect(tomDaVariacaoDoPeso(Number.NaN, meta)).toBe('neutro');
    }
  });
});
