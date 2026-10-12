import { posicaoDoValor, valorAposPasso, valorDaPosicao } from './escalaNota';

describe('escalaNota', () => {
  // largura 300, margem 20: o centro do botão anda de 20 a 280 (260 px para 10 passos).
  it('converte a posição do dedo em nota inteira', () => {
    expect(valorDaPosicao(20, 300, 0, 10, 20)).toBe(0);
    expect(valorDaPosicao(150, 300, 0, 10, 20)).toBe(5);
    expect(valorDaPosicao(280, 300, 0, 10, 20)).toBe(10);
    expect(valorDaPosicao(46, 300, 0, 10, 20)).toBe(1);
    expect(valorDaPosicao(45, 300, 0, 10, 20)).toBe(1);
  });

  it('trava nas pontas quando o dedo sai da faixa', () => {
    expect(valorDaPosicao(-50, 300, 0, 10, 20)).toBe(0);
    expect(valorDaPosicao(900, 300, 0, 10, 20)).toBe(10);
  });

  it('sem largura medida ou posição inválida, não inventa nota', () => {
    expect(valorDaPosicao(10, 0, 0, 10, 20)).toBeNull();
    expect(valorDaPosicao(10, 30, 0, 10, 20)).toBeNull();
    expect(valorDaPosicao(Number.NaN, 300, 0, 10, 20)).toBeNull();
  });

  it('posição e valor são inversos nos pontos da escala', () => {
    for (let n = 0; n <= 10; n += 1) {
      expect(valorDaPosicao(posicaoDoValor(n, 300, 0, 10, 20), 300, 0, 10, 20)).toBe(n);
    }
    expect(posicaoDoValor(-3, 300, 0, 10, 20)).toBe(20);
    expect(posicaoDoValor(99, 300, 0, 10, 20)).toBe(280);
  });

  it('passo do teclado respeita os limites e começa no meio sem valor', () => {
    expect(valorAposPasso(null, 1, 0, 10)).toBe(5);
    expect(valorAposPasso(null, -1, 0, 10)).toBe(5);
    expect(valorAposPasso(10, 1, 0, 10)).toBe(10);
    expect(valorAposPasso(0, -1, 0, 10)).toBe(0);
    expect(valorAposPasso(4, 1, 0, 10)).toBe(5);
  });
});
