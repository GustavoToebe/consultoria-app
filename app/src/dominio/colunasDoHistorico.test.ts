import { colunasDoHistorico, pesoDaDivisao, pesoDaSemana } from './colunasDoHistorico';

describe('colunasDoHistorico', () => {
  it('teto de 2 na normal e na larga e de 3 na ultralarga, quando cabem', () => {
    expect(colunasDoHistorico(1500, 'normal', { pecas: 5 })).toBe(2);
    expect(colunasDoHistorico(1100, 'larga', { pecas: 5 })).toBe(2);
    expect(colunasDoHistorico(1800, 'ultralarga', { pecas: 5 })).toBe(3);
    expect(colunasDoHistorico(900, 'compacta')).toBe(1);
  });

  it('1280 com o menu aberto: o Corpo e as Atualizações (~990 de área) em duas; os Registros ao lado do Progresso em uma', () => {
    expect(colunasDoHistorico(993, 'normal', { pecas: 3, maximo: 2 })).toBe(2);
    expect(colunasDoHistorico(955, 'normal')).toBe(2);
    expect(colunasDoHistorico(581, 'normal', { pecas: 3 })).toBe(1);
    expect(colunasDoHistorico(838, 'normal', { pecas: 3 })).toBe(1);
  });

  it('só as colunas que cabem com a mínima (Limitada na ultralarga fica com 2)', () => {
    expect(colunasDoHistorico(1286, 'ultralarga', { pecas: 5 })).toBe(2);
    expect(colunasDoHistorico(903, 'larga', { pecas: 5 })).toBe(1);
    expect(colunasDoHistorico(904, 'larga', { pecas: 5 })).toBe(2);
  });

  it('bloco de cartões nunca abre coluna vazia; lista sem `pecas` usa o teto', () => {
    expect(colunasDoHistorico(2600, 'ultralarga', { pecas: 2 })).toBe(2);
    expect(colunasDoHistorico(2600, 'ultralarga', { pecas: 1 })).toBe(1);
    expect(colunasDoHistorico(2600, 'ultralarga')).toBe(3);
  });

  it('`maximo` segura as colunas (Corpo: 2 também na ultralarga)', () => {
    expect(colunasDoHistorico(2600, 'ultralarga', { pecas: 3, maximo: 2 })).toBe(2);
    expect(colunasDoHistorico(1100, 'larga', { pecas: 3, maximo: 2 })).toBe(2);
  });

  it('sem medida ainda, uma coluna', () => {
    expect(colunasDoHistorico(0, 'ultralarga', { pecas: 4 })).toBe(1);
    expect(colunasDoHistorico(Number.NaN, 'larga')).toBe(1);
  });
});

describe('pesos da alvenaria', () => {
  it('divisão: cabeçalho + título e linhas de cada exercício', () => {
    expect(pesoDaDivisao({ exercicios: [] })).toBe(2);
    expect(pesoDaDivisao({ exercicios: [{ linhas: [1, 2] }, { linhas: [1] }] })).toBe(2 + 4 + 3);
  });

  it('semana: cabeçalho + cada dia, sessão e exercício', () => {
    expect(pesoDaSemana({ dias: [{ sessoes: [{ exercicios: [1, 2, 3] }] }, { sessoes: [] }] })).toBe(3 + (1 + 1 + 3) + 1);
  });
});
