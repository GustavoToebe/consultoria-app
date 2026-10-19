import type { Serie, Tecnica } from '../api/tipos';
import { agrupar, descreverSeries, tecnicasDoExercicio, textosDeTecnica, textoTecnica, textoTecnicaPorExtenso } from './agrupamento';

const cluster: Tecnica = { tipo: 'CLUSTER', blocos: 3, repsPorBloco: 2, pausaSegundos: 20, retomadas: null, repsPorRetomada: null };
const restPause: Tecnica = { tipo: 'REST_PAUSE', blocos: null, repsPorBloco: null, pausaSegundos: 20, retomadas: 2, repsPorRetomada: null };

function serie(uid: string, tecnica: Tecnica | null = null): Serie {
  return { uid, tipo: 'WS', repsMin: 6, repsMax: 6, alvoTexto: null, intensidade: { modo: 'CARGA_TRABALHO' }, descansoSegundos: null, tecnica };
}

describe('técnica da série (reunião de 17/10)', () => {
  it('texto curto do editor e do PDF', () => {
    expect(textoTecnica(cluster)).toBe('Cluster 3×2, 20 s');
    expect(textoTecnica(restPause)).toBe('Rest pause 20 s +2');
    expect(textoTecnica({ ...restPause, repsPorRetomada: 3 })).toBe('Rest pause 20 s +2×3');
    expect(textoTecnica(null)).toBe('');
  });

  it('texto por extenso para o aluno, sem inventar número', () => {
    expect(textoTecnicaPorExtenso(cluster)).toBe('Cluster: 3 blocos de 2 repetições, 20 s de pausa entre os blocos.');
    expect(textoTecnicaPorExtenso(restPause)).toBe('Rest pause: depois da série, 20 s de pausa e mais 2 retomadas até a falha.');
    expect(textoTecnicaPorExtenso({ ...restPause, retomadas: 1, repsPorRetomada: 3 })).toBe(
      'Rest pause: depois da série, 20 s de pausa e mais 1 retomada de 3 repetições.',
    );
    expect(textoTecnicaPorExtenso({ ...cluster, blocos: null })).toBe('Cluster: ? blocos de 2 repetições, 20 s de pausa entre os blocos.');
  });

  it('séries com técnicas diferentes não se juntam no mesmo grupo, e o resumo diz a técnica', () => {
    const series = [serie('a'), serie('b', cluster), serie('c', cluster)];
    expect(agrupar(series).map((g) => g.series.length)).toEqual([1, 2]);
    expect(descreverSeries(series)).toEqual(['1x6 - WS', '2x6 - WS · Cluster 3×2, 20 s']);
  });

  it('cada técnica traz a pausa para o botão do cronômetro', () => {
    expect(tecnicasDoExercicio([serie('a', cluster), serie('b', cluster), serie('c', restPause), serie('d')]).map((t) => t.pausaSegundos)).toEqual([
      cluster.pausaSegundos,
      restPause.pausaSegundos,
    ]);
    expect(tecnicasDoExercicio([serie('a', { ...cluster, pausaSegundos: null })])[0].pausaSegundos).toBeNull();
  });

  it('o aluno lê cada técnica uma vez', () => {
    expect(textosDeTecnica([serie('a', cluster), serie('b', cluster), serie('c', restPause), serie('d')])).toEqual([
      textoTecnicaPorExtenso(cluster),
      textoTecnicaPorExtenso(restPause),
    ]);
  });
});
