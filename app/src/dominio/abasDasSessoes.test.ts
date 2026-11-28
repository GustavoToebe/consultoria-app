import { diaETipoDaSessao, linhaDaSessao, partesDaSessao } from './abasDasSessoes';
import { exercicio, sessao } from './exemplosDeTreino.apoioTeste';

const exercicios = (n: number) => Array.from({ length: n }, (_, i) => exercicio(`e${i}`));

describe('partesDaSessao', () => {
  it('dia curto e o nome inteiro', () => {
    const s = sessao('s', exercicios(7), [], { nome: 'Full Body 1', diaSemana: 1 });
    expect(partesDaSessao(s, 0)).toEqual({ dia: 'Seg', nome: 'Full Body 1', descanso: false, rotuloAcessivel: 'Seg · Full Body 1, 7 exercícios' });
  });

  it('só cai o prefixo do próprio dia, seguido de separador', () => {
    const nome = (n: string, diaSemana: number | null = 1) => partesDaSessao(sessao('s', [], [], { nome: n, diaSemana }), 0).nome;
    expect(nome('Segunda - Costas')).toBe('Costas');
    expect(nome('segunda · Costas')).toBe('Costas');
    expect(nome('Segunda: Costas')).toBe('Costas');
    expect(nome('Segundas e quintas')).toBe('Segundas e quintas');
    expect(nome('Terça - Costas')).toBe('Terça - Costas');
    expect(nome('Segunda - Costas', null)).toBe('Segunda - Costas');
    expect(nome('Treino A - Costas')).toBe('Treino A - Costas');
  });

  it('"-feira" é parte do dia: "Segunda-feira - Costas" vira "Costas", não "feira - Costas"', () => {
    const nome = (n: string) => partesDaSessao(sessao('s', [], [], { nome: n, diaSemana: 1 }), 0).nome;
    expect(nome('Segunda-feira - Costas')).toBe('Costas');
    expect(nome('Segunda feira: Costas')).toBe('Costas');
    expect(nome('Segunda-feira')).toBe('Treino');
    expect(nome('Segunda-Costas')).toBe('Costas');
  });

  it('nome que é só o dia vira o tipo; sem dia e sem nome, "Sessão N"', () => {
    expect(partesDaSessao(sessao('s', [], [], { nome: 'Quarta', diaSemana: 3, tipo: 'DESCANSO' }), 2).nome).toBe('Descanso');
    expect(partesDaSessao(sessao('s', [], [], { nome: 'Segunda', diaSemana: 1 }), 0).nome).toBe('Treino');
    expect(partesDaSessao(sessao('s', [], [], { nome: '  ', diaSemana: null }), 4)).toMatchObject({ dia: null, nome: 'Sessão 5' });
  });

  it('descanso só para DESCANSO; DESCANSO_ATIVO mantém a contagem', () => {
    expect(partesDaSessao(sessao('s', [], [], { tipo: 'DESCANSO' }), 0).descanso).toBe(true);
    expect(partesDaSessao(sessao('s', exercicios(1), [], { tipo: 'DESCANSO_ATIVO' }), 0).descanso).toBe(false);
  });

  it('nome acessível no formato do chip, no singular', () => {
    const s = sessao('s', exercicios(1), [], { nome: 'Segunda - Costas', diaSemana: 1 });
    expect(partesDaSessao(s, 0).rotuloAcessivel).toBe('Seg · Costas, 1 exercício');
  });
});

describe('cabeçalho da sessão', () => {
  it('dia e tipo, e a linha com os totais', () => {
    const s = sessao('s', [], [], { diaSemana: 1 });
    expect(diaETipoDaSessao(s)).toBe('Segunda · Treino');
    expect(linhaDaSessao(s, { exercicios: 7, series: 23, seriesDeTrabalho: 16 })).toBe('Segunda · Treino · 7 exercícios · 23 séries · 16 de trabalho');
  });

  it('sem dia fixo e com frequência', () => {
    expect(diaETipoDaSessao(sessao('s', [], [], { tipo: 'DESCANSO_ATIVO' }))).toBe('Sem dia fixo · Descanso ativo');
    expect(diaETipoDaSessao(sessao('s', [], [], { frequenciaSemanal: 3 }))).toBe('3x na semana · Treino');
  });
});
