import { enfaseDoNumero } from './destaque';

describe('enfaseDoNumero (D5)', () => {
  it('valor positivo leva a cor da função', () => {
    expect(enfaseDoNumero('vermelho', 3)).toBe('vermelho');
    expect(enfaseDoNumero('violeta', 0.5)).toBe('violeta');
  });
  it('zero e sem dado ficam apagados, nunca na cor da função', () => {
    expect(enfaseDoNumero('vermelho', 0)).toBe('apagado');
    expect(enfaseDoNumero('verde', null)).toBe('apagado');
    expect(enfaseDoNumero('verde', undefined)).toBe('apagado');
    expect(enfaseDoNumero('azul', Number.NaN)).toBe('apagado');
  });
  it('sem função ou valor negativo fica neutro', () => {
    expect(enfaseDoNumero(null, 7)).toBe('neutro');
    expect(enfaseDoNumero('azul', -100)).toBe('neutro');
  });
});
