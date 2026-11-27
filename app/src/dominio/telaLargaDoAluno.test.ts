import { colunasDaGradeDoAluno, telaLargaDoAluno } from './telaLargaDoAluno';

describe('telaLargaDoAluno', () => {
  it('só a larga e a ultralarga contam como tela larga', () => {
    expect(['compacta', 'normal', 'larga', 'ultralarga'].map((f) => telaLargaDoAluno(f as never))).toEqual([false, false, true, true]);
  });
});

describe('colunasDaGradeDoAluno', () => {
  it('sem medida, uma coluna', () => {
    expect(colunasDaGradeDoAluno(0, 5, 8)).toBe(1);
  });

  it('cabendo numa linha, as colunas que cabem com a célula mínima (o cartão não estica)', () => {
    // 1688 de grade com vão 8: cabem 4 de 360.
    expect(colunasDaGradeDoAluno(1688, 1, 8)).toBe(4);
    expect(colunasDaGradeDoAluno(1688, 3, 8)).toBe(4);
    expect(colunasDaGradeDoAluno(1688, 4, 8)).toBe(4);
  });

  it('em mais de uma linha, sem cartão sozinho na última', () => {
    expect(colunasDaGradeDoAluno(1688, 5, 8)).toBe(3); // 3 + 2
    expect(colunasDaGradeDoAluno(1688, 6, 8)).toBe(3); // 3 + 3
    expect(colunasDaGradeDoAluno(1688, 7, 8)).toBe(4); // 4 + 3
    expect(colunasDaGradeDoAluno(1264, 4, 12)).toBe(2); // cabem 3: 4 viraria 3 + 1, então 2 + 2
  });

  it('sem divisão sem sobra, fica com as que cabem em vez de esticar numa coluna só', () => {
    expect(colunasDaGradeDoAluno(1072, 5, 12)).toBe(2); // 2 + 2 + 1, nunca 5 cartões de 1072
  });
});
