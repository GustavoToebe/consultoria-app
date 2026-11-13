import { enfaseDoNumero } from './destaque';

describe('enfaseDoNumero (D5)', () => {
  it('valor positivo leva a cor da função', () => {
    expect(enfaseDoNumero('vermelho', 3)).toBe('vermelho');
    expect(enfaseDoNumero('violeta', 0.5)).toBe('violeta');
  });
  it('zero e sem dado ficam sem cor de função e distintos entre si (D14)', () => {
    expect(enfaseDoNumero('vermelho', 0)).toBe('zero');
    expect(enfaseDoNumero(null, 0)).toBe('zero');
    expect(enfaseDoNumero('verde', null)).toBe('indisponivel');
    expect(enfaseDoNumero('verde', undefined)).toBe('indisponivel');
    expect(enfaseDoNumero('azul', Number.NaN)).toBe('indisponivel');
  });
  it('sem função ou valor negativo fica neutro', () => {
    expect(enfaseDoNumero(null, 7)).toBe('neutro');
    expect(enfaseDoNumero('azul', -100)).toBe('neutro');
  });
});
