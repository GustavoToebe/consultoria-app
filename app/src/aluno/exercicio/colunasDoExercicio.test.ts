import { colunaDasSeriesNoBloco, colunasDoExercicio } from './colunasDoExercicio';

const TUDO = { proximo: true, historico: true };

describe('colunasDoExercicio', () => {
  it('sem medida ou sem espaço para 560 + 32 + apoio fica no desenho do celular', () => {
    expect(colunasDoExercicio(null, 'compacta', TUDO)).toBeNull();
    expect(colunasDoExercicio(0, 'compacta', TUDO)).toBeNull();
    expect(colunasDoExercicio(358, 'compacta', TUDO)).toBeNull();
    expect(colunasDoExercicio(971, 'compacta', TUDO)).toBeNull();
    expect(colunasDoExercicio(972, 'compacta', TUDO)).toEqual({ apoio: 380, series: 560, extras: 0, colunasDosExtras: 0 });
  });

  it('na faixa normal as séries ocupam o resto, sem 3ª coluna', () => {
    expect(colunasDoExercicio(1246, 'normal', TUDO)).toEqual({ apoio: 380, series: 834, extras: 0, colunasDosExtras: 0 });
  });

  it('na larga as séries cedem até 640 para a 3ª coluna abrir com 340', () => {
    // 1920 com o menu aberto: ~1600 de largura útil.
    expect(colunasDoExercicio(1600, 'larga', TUDO)).toEqual({ apoio: 420, series: 776, extras: 340, colunasDosExtras: 1 });
    // Séries abaixo de 640: a 3ª coluna não abre e as séries ocupam o resto.
    expect(colunasDoExercicio(1450, 'larga', TUDO)).toEqual({ apoio: 420, series: 998, extras: 0, colunasDosExtras: 0 });
  });

  it('as séries param em 880 e a sobra vira 3ª coluna, em duas a partir de 752', () => {
    // Limitada (1800) na ultralarga.
    expect(colunasDoExercicio(1800, 'ultralarga', TUDO)).toEqual({ apoio: 440, series: 880, extras: 416, colunasDosExtras: 1 });
    // 3440 com o menu aberto, Automática.
    expect(colunasDoExercicio(3057, 'ultralarga', TUDO)).toEqual({ apoio: 440, series: 880, extras: 1673, colunasDosExtras: 2 });
    const c = colunasDoExercicio(2300, 'larga', TUDO)!;
    expect(c.apoio + 32 + c.series + 32 + c.extras).toBe(2300);
    expect(c.colunasDosExtras).toBe(2);
  });

  it('só o próximo (sem histórico) não estica: a 3ª coluna tem a largura do apoio', () => {
    expect(colunasDoExercicio(3057, 'ultralarga', { proximo: true, historico: false })).toEqual({ apoio: 440, series: 2113, extras: 440, colunasDosExtras: 1 });
    expect(colunasDoExercicio(1460, 'larga', { proximo: true, historico: false })).toEqual({ apoio: 420, series: 1008, extras: 0, colunasDosExtras: 0 });
  });

  it('sem próximo nem histórico, as séries ocupam o resto', () => {
    expect(colunasDoExercicio(3057, 'ultralarga', { proximo: false, historico: false })).toEqual({ apoio: 440, series: 2585, extras: 0, colunasDosExtras: 0 });
  });
});

describe('colunaDasSeriesNoBloco', () => {
  it('começa depois da coluna do exercício e do vão, na largura das séries', () => {
    expect(colunaDasSeriesNoBloco({ apoio: 420, series: 776, extras: 340, colunasDosExtras: 1 })).toEqual({ esquerda: 452, largura: 776 });
  });
});
