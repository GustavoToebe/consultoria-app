import { colunasDosExercicios, dividirPorPeso } from './colunasDoTreinoDoDia';

describe('colunasDosExercicios', () => {
  it('uma coluna até caberem duas de 520, no máximo três', () => {
    expect(colunasDosExercicios(0, 24)).toBe(1);
    expect(colunasDosExercicios(834, 24)).toBe(1);
    expect(colunasDosExercicios(1064, 24)).toBe(2);
    expect(colunasDosExercicios(1789, 24)).toBe(3);
    expect(colunasDosExercicios(2585, 24)).toBe(3);
  });
});

describe('dividirPorPeso', () => {
  it('sem peças, nada', () => {
    expect(dividirPorPeso([], 3)).toEqual([]);
  });

  it('peças iguais: as maiores colunas primeiro, na ordem', () => {
    expect(dividirPorPeso([1, 1, 1, 1, 1], 3)).toEqual([[0, 1], [2, 3], [4]]);
    expect(dividirPorPeso([1, 1, 1, 1, 1], 2)).toEqual([[0, 1, 2], [3, 4]]);
    expect(dividirPorPeso([1, 1, 1, 1, 1, 1], 3)).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it('a combinação conta pelos exercícios e nunca se parte', () => {
    // Bi-set (2) + quatro exercícios soltos em 2 colunas: 3 e 3.
    expect(dividirPorPeso([2, 1, 1, 1, 1], 2)).toEqual([[0, 1], [2, 3, 4]]);
    // Circuito de 4 no meio.
    expect(dividirPorPeso([1, 4, 1, 1], 2)).toEqual([[0, 1], [2, 3]]);
  });

  it('menos peças que colunas: uma por coluna, sem coluna vazia', () => {
    expect(dividirPorPeso([3, 1], 3)).toEqual([[0], [1]]);
    expect(dividirPorPeso([1], 3)).toEqual([[0]]);
  });

  it('uma coluna leva tudo', () => {
    expect(dividirPorPeso([1, 2, 1], 1)).toEqual([[0, 1, 2]]);
  });
});
