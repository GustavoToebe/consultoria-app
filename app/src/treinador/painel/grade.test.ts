import { colunasDaGrade, linhasDaGrade } from './grade';

describe('grade do painel', () => {
  it('colunas pela largura: 1 no celular, 4 no PC', () => {
    expect(colunasDaGrade(0)).toBe(1);
    expect(colunasDaGrade(358)).toBe(1);
    expect(colunasDaGrade(500)).toBe(2);
    expect(colunasDaGrade(720)).toBe(3);
    expect(colunasDaGrade(990)).toBe(4);
    expect(colunasDaGrade(1600)).toBe(4);
  });

  it('na ordem padrão, com 4 colunas: 4 blocos, Agenda e Financeiro, barras e rosca', () => {
    const linhas = linhasDaGrade(['atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'financeiro', 'recebido', 'alunos'], 4);
    expect(linhas.map((l) => l.map((c) => `${c.id}:${c.colunas}`))).toEqual([
      ['atualizacoes:1', 'interessados:1', 'treinos:1', 'pastas:1'],
      ['agenda:2', 'financeiro:2'],
      ['recebido:3', 'alunos:1'],
    ]);
  });

  it('com 1 coluna, um bloco por linha, sem passar da grade', () => {
    const linhas = linhasDaGrade(['recebido', 'agenda', 'alunos'], 1);
    expect(linhas).toEqual([[{ id: 'recebido', colunas: 1 }], [{ id: 'agenda', colunas: 1 }], [{ id: 'alunos', colunas: 1 }]]);
  });

  it('o bloco que não cabe começa a linha seguinte', () => {
    const linhas = linhasDaGrade(['alunos', 'pastas', 'recebido'], 4);
    expect(linhas.map((l) => l.map((c) => c.id))).toEqual([['alunos', 'pastas'], ['recebido']]);
  });
});
