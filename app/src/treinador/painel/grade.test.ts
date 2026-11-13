import { colunasDaGrade, larguraDoTitulo, linhasDaGrade } from './grade';

describe('grade do painel', () => {
  it('colunas pela largura: 1 no celular, 3 em 1280 e 1440 com o menu aberto, 4 no PC largo', () => {
    expect(colunasDaGrade(0)).toBe(1);
    expect(colunasDaGrade(358)).toBe(1);
    expect(colunasDaGrade(640)).toBe(2);
    // 1280 com o menu aberto (~980 a 1000 px de painel, com ou sem a barra de rolagem do Windows) e 1440 (~1160).
    expect(colunasDaGrade(980)).toBe(3);
    expect(colunasDaGrade(1160)).toBe(3);
    // 1920 (~1640) e 1440 com o menu recolhido (~1320).
    expect(colunasDaGrade(1320)).toBe(4);
    expect(colunasDaGrade(1640)).toBe(4);
  });

  it('cada coluna cabe o título e os três ícones numa linha, também com o texto ampliado', () => {
    for (const fator of [1, 1.12, 1.25, 1.4]) {
      for (let largura = 300; largura <= 2000; largura += 7) {
        const colunas = colunasDaGrade(largura, fator);
        const bloco = (largura - 16 * (colunas - 1)) / colunas;
        if (colunas > 1) expect(bloco - 42).toBeGreaterThanOrEqual(larguraDoTitulo(fator) + 3 * 44 + 4 + 8);
      }
    }
    expect(colunasDaGrade(980, 1.4)).toBe(2);
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

  it('o tamanho escolhido muda a largura; ausente vale o de fábrica; nunca passa da grade', () => {
    const ids = ['alunos', 'agenda', 'pastas'] as const;
    const tam = (n: number, t?: Parameters<typeof linhasDaGrade>[2]) => linhasDaGrade(ids, n, t).map((l) => l.map((c) => `${c.id}:${c.colunas}`));
    expect(tam(4, { alunos: 3, agenda: 1 })).toEqual([['alunos:3', 'agenda:1'], ['pastas:1']]);
    expect(tam(2, { alunos: 3 })).toEqual([['alunos:2'], ['agenda:2'], ['pastas:1']]);
    expect(tam(4)).toEqual([['alunos:1', 'agenda:2', 'pastas:1']]);
    // Em 1 coluna o tamanho não tem efeito (continua gravado para a tela larga).
    expect(tam(1, { alunos: 3, pastas: 2 })).toEqual([['alunos:1'], ['agenda:1'], ['pastas:1']]);
  });

  it('o bloco que não cabe começa a linha seguinte', () => {
    const linhas = linhasDaGrade(['alunos', 'pastas', 'recebido'], 4);
    expect(linhas.map((l) => l.map((c) => c.id))).toEqual([['alunos', 'pastas'], ['recebido']]);
  });
});
