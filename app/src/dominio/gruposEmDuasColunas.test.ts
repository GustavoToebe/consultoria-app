import { gruposNaEsquerda, MINIMO_DA_METADE } from './gruposEmDuasColunas';

// tela larga: revisão (24/11): os grupos da lista de alunos dividem-se em duas colunas só quando cada metade cabe a lista.
describe('gruposNaEsquerda', () => {
  const vao = 24;

  it('uma coluna só sem medida, com um grupo só ou com metade abaixo do mínimo', () => {
    expect(gruposNaEsquerda([5, 5], 0, { vao })).toBeNull();
    expect(gruposNaEsquerda([12], 3000, { vao })).toBeNull();
    expect(gruposNaEsquerda([], 3000, { vao })).toBeNull();
    // 1920 com o menu aberto (~1650 px) e 1800 (Limitada): metade abaixo de 1000.
    expect(gruposNaEsquerda([5, 5], 1650, { vao })).toBeNull();
    expect(gruposNaEsquerda([5, 5], 1800, { vao })).toBeNull();
    expect(gruposNaEsquerda([5, 5], 2 * MINIMO_DA_METADE + vao - 1, { vao })).toBeNull();
  });

  it('a partir de duas metades de 1000 px (2560 e 3440 com o menu aberto), duas colunas', () => {
    expect(gruposNaEsquerda([5, 5], 2 * MINIMO_DA_METADE + vao, { vao })).toBe(1);
    expect(gruposNaEsquerda([1, 1], 2288, { vao })).toBe(1);
    expect(gruposNaEsquerda([1, 1], 3104, { vao })).toBe(1);
  });

  it('o texto ampliado pede metades maiores', () => {
    expect(gruposNaEsquerda([5, 5], 2288, { vao, fatorTexto: 1.25 })).toBeNull();
    expect(gruposNaEsquerda([5, 5], 3104, { vao, fatorTexto: 1.25 })).toBe(1);
  });

  it('o corte equilibra as alturas e mantém a ordem (a esquerda leva os primeiros)', () => {
    // Para revisar 5, Atrasados 5, Em dia 11, Sem pasta 2: [7, 7] contra [13, 4].
    expect(gruposNaEsquerda([5, 5, 11, 2], 3104, { vao })).toBe(2);
    // Um grupo grande primeiro fica sozinho à esquerda.
    expect(gruposNaEsquerda([20, 3, 4], 3104, { vao })).toBe(1);
    // Empate fica com o primeiro corte.
    expect(gruposNaEsquerda([4, 4], 3104, { vao })).toBe(1);
    // O último grupo grande fica sozinho à direita.
    expect(gruposNaEsquerda([2, 2, 2, 30], 3104, { vao })).toBe(3);
  });
});
