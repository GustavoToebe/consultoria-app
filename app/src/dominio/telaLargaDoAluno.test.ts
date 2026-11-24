import { colunasDaGradeDoAluno, faixasDoInicio, LARGURA_TELA_DO_ALUNO, larguraDaTelaDoAluno, telaLargaDoAluno } from './telaLargaDoAluno';

// tela larga: revisão (24/11)
describe('larguraDaTelaDoAluno', () => {
  it('mantém o teto de 1120 até a faixa normal (celular, tablet e PC de 1280)', () => {
    expect(LARGURA_TELA_DO_ALUNO).toBe(1120);
    expect(larguraDaTelaDoAluno('compacta')).toBe(1120);
    expect(larguraDaTelaDoAluno('normal')).toBe(1120);
  });

  it('ganha a terceira faixa na larga e na ultralarga, nunca uma quarta', () => {
    expect(larguraDaTelaDoAluno('larga')).toBe(1688);
    expect(larguraDaTelaDoAluno('ultralarga')).toBe(1688);
  });

  it('a tela que só tem duas faixas de conteúdo fica em 1120 em qualquer faixa', () => {
    expect(larguraDaTelaDoAluno('ultralarga', 2)).toBe(1120);
  });

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

// tela larga: revisão (24/11)
describe('faixasDoInicio', () => {
  it('reserva a terceira coluna só quando o nível ou a vitrine vão aparecer', () => {
    expect(faixasDoInicio({ retornoHabilitado: true, online: true, itensNaVitrine: 0 })).toBe(3);
    expect(faixasDoInicio({ retornoHabilitado: false, online: true, itensNaVitrine: 2 })).toBe(3);
    expect(faixasDoInicio({ retornoHabilitado: true, online: false, itensNaVitrine: 1 })).toBe(3);
  });

  it('sem nível (retorno desligado ou sem internet) e sem itens na vitrine, fica em duas colunas', () => {
    expect(faixasDoInicio({ retornoHabilitado: false, online: true, itensNaVitrine: 0 })).toBe(2);
    expect(faixasDoInicio({ retornoHabilitado: true, online: false, itensNaVitrine: 0 })).toBe(2);
  });
});
