import { colunaDasSeriesNoBloco, exercicioEmColunas } from './colunasDoExercicio';

describe('exercicioEmColunas', () => {
  it('sem medida ainda fica no desenho do celular', () => {
    expect(exercicioEmColunas(null)).toBe(false);
    expect(exercicioEmColunas(0)).toBe(false);
  });

  it('abre as duas colunas a partir de 560 + 32 + 400 de área', () => {
    expect(exercicioEmColunas(390)).toBe(false);
    expect(exercicioEmColunas(991)).toBe(false);
    expect(exercicioEmColunas(992)).toBe(true);
    expect(exercicioEmColunas(1312)).toBe(true);
  });
});

describe('colunaDasSeriesNoBloco', () => {
  it('começa depois da coluna do exercício e do vão e para em 720', () => {
    expect(colunaDasSeriesNoBloco(1312)).toEqual({ esquerda: 432, largura: 720 });
    expect(colunaDasSeriesNoBloco(1000)).toEqual({ esquerda: 432, largura: 568 });
  });
});
