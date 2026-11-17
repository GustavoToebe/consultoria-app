import { linhasDosRecordes } from './historicoDoExercicio';

describe('linhasDosRecordes', () => {
  it('sem recordes do exercício, as três linhas ficam em "—"', () => {
    expect(linhasDosRecordes(null).map((l) => l.valor)).toEqual(['—', '—', '—']);
    expect(linhasDosRecordes(undefined).map((l) => l.rotulo)).toEqual(['Maior carga', 'Mais repetições', 'Maior volume']);
  });

  it('mostra maior carga, a maior contagem de repetições com a carga dela e o maior volume', () => {
    const linhas = linhasDosRecordes({
      maiorCarga: 62.5,
      maiorVolume: 600,
      repeticoesPorCarga: [{ carga: 50, repeticoes: 12 }, { carga: 60, repeticoes: 10 }, { carga: 62.5, repeticoes: 6 }],
    });
    expect(linhas.map((l) => l.valor)).toEqual(['62,5 kg', '12 com 50 kg', '600 kg']);
  });

  it('empate nas repetições fica com a carga maior', () => {
    const [, mais] = linhasDosRecordes({ maiorCarga: 60, maiorVolume: 480, repeticoesPorCarga: [{ carga: 40, repeticoes: 8 }, { carga: 60, repeticoes: 8 }] });
    expect(mais.valor).toBe('8 com 60 kg');
  });

  it('sem linha de repetições, só "Mais repetições" fica em "—"', () => {
    expect(linhasDosRecordes({ maiorCarga: 40, maiorVolume: 320, repeticoesPorCarga: [] }).map((l) => l.valor)).toEqual(['40 kg', '—', '320 kg']);
  });

  it('em libra, a carga sai convertida', () => {
    expect(linhasDosRecordes({ maiorCarga: 60, maiorVolume: 600, repeticoesPorCarga: [{ carga: 60, repeticoes: 5 }] }, 'lb')[0].valor).toBe('132,3 lb');
  });
});
