import { colunasDaConta, colunasEquilibradas } from './colunasDaConta';

describe('colunasDaConta', () => {
  it('uma coluna na compacta, por mais largo que seja', () => {
    expect(colunasDaConta(990, 'compacta', 24, 9)).toBe(1);
    expect(colunasDaConta(358, 'compacta', 24, 9)).toBe(1);
  });

  it('duas na normal, três na larga e na ultralarga (o teto da faixa)', () => {
    expect(colunasDaConta(1000, 'normal', 24, 9)).toBe(2);
    expect(colunasDaConta(1500, 'normal', 24, 9)).toBe(2);
    expect(colunasDaConta(1600, 'larga', 24, 9)).toBe(3);
    expect(colunasDaConta(3100, 'ultralarga', 24, 9)).toBe(3);
  });

  it('não passa do que cabe com a célula mínima nem do número de peças', () => {
    expect(colunasDaConta(880, 'normal', 24, 9)).toBe(1);
    expect(colunasDaConta(1300, 'larga', 24, 9)).toBe(2);
    expect(colunasDaConta(3100, 'ultralarga', 24, 2)).toBe(2);
    expect(colunasDaConta(0, 'larga', 24, 9)).toBe(1);
  });
});

const alturasDasColunas = (alturas: number[], coluna: number[], colunas: number, vao: number) =>
  Array.from({ length: colunas }, (_, c) => alturas.filter((_, i) => coluna[i] === c).reduce((s, a, i) => s + a + (i ? vao : 0), 0));

describe('colunasEquilibradas', () => {
  // A Conta medida em 1920 (perfil, comunidade, dados, convite, privacidade, segurança, app e excluir): a alvenaria comum
  // deixava 277 px de buraco porque "App" (a mais alta) chegava no fim.
  const conta = [172, 98, 92, 190, 244, 152, 290, 90];

  it('o perfil no topo da primeira coluna e as colunas terminando perto da mesma altura', () => {
    const coluna = colunasEquilibradas(conta, 3, 24);
    expect(coluna[0]).toBe(0);
    const fins = alturasDasColunas(conta, coluna, 3, 24);
    expect(Math.max(...fins) - Math.min(...fins)).toBeLessThan(100);
    expect(new Set(coluna).size).toBe(3);
  });

  it('em duas colunas também', () => {
    const fins = alturasDasColunas(conta, colunasEquilibradas(conta, 2, 24), 2, 24);
    expect(Math.max(...fins) - Math.min(...fins)).toBeLessThan(100);
  });

  it('uma coluna ou nenhuma peça: tudo na primeira', () => {
    expect(colunasEquilibradas(conta, 1, 24)).toEqual(conta.map(() => 0));
    expect(colunasEquilibradas([], 3, 24)).toEqual([]);
  });
});
