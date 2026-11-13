import { enfaseDaMedida, enfaseDoNumero } from './destaque';

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

describe('enfaseDaMedida (medida calculada, não contagem)', () => {
  it('zero com base válida mantém a cor da função; sem função fica neutro, nunca o zero apagado', () => {
    expect(enfaseDaMedida('azul', 0)).toBe('azul');
    expect(enfaseDaMedida('violeta', 0)).toBe('violeta');
    expect(enfaseDaMedida(null, 0)).toBe('neutro');
    expect(enfaseDaMedida('azul', 12.5)).toBe('azul');
  });
  it('sem base continua indisponível com o motivo, e negativo neutro', () => {
    expect(enfaseDaMedida('azul', null)).toBe('indisponivel');
    expect(enfaseDaMedida('azul', undefined)).toBe('indisponivel');
    expect(enfaseDaMedida('azul', Number.NaN)).toBe('indisponivel');
    expect(enfaseDaMedida('azul', -1)).toBe('neutro');
  });
});
