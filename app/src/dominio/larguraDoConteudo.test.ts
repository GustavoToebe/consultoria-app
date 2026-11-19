import { LARGURA_EDITOR, LARGURA_FORMULARIO, LARGURA_LISTA, LARGURA_MAXIMA } from '../tema/tokens';
import { larguraMaximaDoConteudo, respiroLateralDaTela } from './larguraDoConteudo';

describe('larguraMaximaDoConteudo', () => {
  it('remove o teto de 1800 px quando a preferência é AUTOMATICA', () => {
    expect(larguraMaximaDoConteudo(undefined, 'AUTOMATICA')).toBeUndefined();
    expect(larguraMaximaDoConteudo(LARGURA_MAXIMA, 'AUTOMATICA')).toBeUndefined();
    expect(larguraMaximaDoConteudo(LARGURA_LISTA, 'AUTOMATICA')).toBeUndefined();
  });

  it('mantém o teto de 1800 px quando a preferência é LIMITADA', () => {
    expect(larguraMaximaDoConteudo(undefined, 'LIMITADA')).toBe(LARGURA_MAXIMA);
    expect(larguraMaximaDoConteudo(LARGURA_MAXIMA, 'LIMITADA')).toBe(LARGURA_MAXIMA);
    expect(larguraMaximaDoConteudo(LARGURA_LISTA, 'LIMITADA')).toBe(LARGURA_MAXIMA);
  });

  it('preserva tetos menores (formulários curtos, aluno e editor de 1 coluna) nos dois modos', () => {
    for (const modo of ['AUTOMATICA', 'LIMITADA'] as const) {
      expect(larguraMaximaDoConteudo(LARGURA_FORMULARIO, modo)).toBe(LARGURA_FORMULARIO);
      expect(larguraMaximaDoConteudo(720, modo)).toBe(720);
      expect(larguraMaximaDoConteudo(LARGURA_EDITOR, modo)).toBe(LARGURA_EDITOR);
    }
  });
});

describe('respiroLateralDaTela', () => {
  it('sobe o respiro lateral para 48 px na faixa ultralarga e preserva nas demais', () => {
    expect(respiroLateralDaTela('compacta')).toBeUndefined();
    expect(respiroLateralDaTela('normal', 28)).toBe(28);
    expect(respiroLateralDaTela('larga', 16)).toBe(16);
    expect(respiroLateralDaTela('ultralarga')).toBe(48);
    expect(respiroLateralDaTela('ultralarga', 28)).toBe(48);
    expect(respiroLateralDaTela('ultralarga', 64)).toBe(64);
  });
});
