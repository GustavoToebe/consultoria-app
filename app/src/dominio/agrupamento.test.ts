import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { novaSerie, mudarQuantidade, tecnicaVazia } from './editorTreino';
import type { Serie, Tecnica } from '../api/tipos';
import { agrupar, descreverSeries, resumoTecnicasEDescanso, tecnicasDoExercicio, textosDeTecnica, textoTecnica, textoTecnicaPorExtenso } from './agrupamento';

const cluster: Tecnica = { ...tecnicaVazia('CLUSTER'), blocos: [2,2,2], pausaSegundos: 20 };
const restPause: Tecnica = { ...tecnicaVazia('REST_PAUSE'), pausaSegundos: 20, pausas: 2 };
const dropSet: Tecnica = {
  tipo: 'DROP_SET',
  blocos: null,
  pausaRespiracoes: null,
  pausaSegundos: null,
  pausas: null,
  quedas: 2,
  reducaoPercentual: 20,
  repsPorQueda: null,
};

function serie(uid: string, tecnica: Tecnica | null = null): Serie {
  return { uid, tipo: 'WS', repsMin: 6, repsMax: 6, intensidade: { modo: 'CARGA_TRABALHO' }, descansoSegundos: null, tecnica };
}

describe('técnica da série (reunião de 17/10)', () => {
  it('texto curto do editor e do PDF', () => {
    expect(textoTecnica(cluster)).toBe('Cluster 3×2, 20 s');
    expect(textoTecnica(restPause)).toBe('Rest pause 20 s, 2 pausas');
    expect(textoTecnica({ ...restPause, pausas: 1 })).toBe('Rest pause 20 s');
    expect(textoTecnica(null)).toBe('');
  });

  it('texto por extenso para o aluno, sem inventar número', () => {
    expect(textoTecnicaPorExtenso(cluster)).toBe('Cluster: 3 blocos de 2 repetições, 20 s de pausa entre os blocos.');
    expect(textoTecnicaPorExtenso(restPause)).toBe('Rest pause: depois da série, 20 s de pausa e continue com a mesma carga até a falha, 2 vezes.');
    expect(textoTecnicaPorExtenso({ ...restPause, pausas: 1 })).toBe(
      'Rest pause: depois da série, 20 s de pausa e continue com a mesma carga até a falha.',
    );
    expect(textoTecnicaPorExtenso({ ...cluster, blocos: null })).toBe('Cluster: a série dividida em blocos de repetições, com 20 s de pausa entre os blocos.');
  });

  it('séries com técnicas diferentes não se juntam no mesmo grupo, e o resumo diz a técnica', () => {
    const series = [serie('a'), serie('b', cluster), serie('c', cluster)];
    expect(agrupar(series).map((g) => g.series.length)).toEqual([1, 2]);
    expect(descreverSeries(series)).toEqual(['1x6 - WS', '2x6 (3×2) - WS + Cluster 20 s']);
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

describe('drop-set', () => {
  it('texto curto: quedas, repetições fixas e redução só quando o treinador escreveu', () => {
    expect(textoTecnica(dropSet)).toBe('Drop-set 2× −20%');
    expect(textoTecnica({ ...dropSet, reducaoPercentual: null })).toBe('Drop-set 2×');
    expect(textoTecnica({ ...dropSet, repsPorQueda: 8 })).toBe('Drop-set 2×8 −20%');
    expect(textoTecnica({ ...dropSet, quedas: null })).toBe('Drop-set —× −20%');
  });

  it('por extenso para o aluno, sem inventar a redução', () => {
    expect(textoTecnicaPorExtenso(dropSet)).toBe('Drop-set: ao terminar, reduza a carga cerca de 20% e continue até a falha, 2 vezes.');
    expect(textoTecnicaPorExtenso({ ...dropSet, reducaoPercentual: null })).toBe('Drop-set: ao terminar, reduza a carga e continue até a falha, 2 vezes.');
    expect(textoTecnicaPorExtenso({ ...dropSet, quedas: 1, repsPorQueda: 6 })).toBe(
      'Drop-set: ao terminar, reduza a carga cerca de 20% e faça mais 6 repetições, 1 vez.',
    );
  });

  it('não tem pausa para o cronômetro e não se junta a série simples nem a outra técnica', () => {
    expect(tecnicasDoExercicio([serie('a', dropSet)])[0].pausaSegundos).toBeNull();
    expect(agrupar([serie('a'), serie('b', dropSet), serie('c', dropSet), serie('d', cluster)]).map((g) => g.series.length)).toEqual([1, 2, 1]);
    expect(descreverSeries([serie('a', dropSet)])).toEqual(['1x6 - WS + Drop-set 2× −20%']);
  });
});

describe('resumo de técnicas e descanso na lista do dia', () => {
  const s = (tecnica?: Tecnica | null, descansoSegundos: number | null = null): Serie =>
    ({ uid: 'x', tipo: 'WS', repsMin: 6, repsMax: 8, intensidade: null, descansoSegundos, tecnica }) as Serie;
  const cluster: Tecnica = { ...tecnicaVazia('CLUSTER'), blocos: [4,4,4], pausaSegundos: 20 };
  const drop: Tecnica = { ...tecnicaVazia('DROP_SET'), quedas: 2 };
  it('diz a série de cada técnica e o descanso', () => {
    expect(resumoTecnicasEDescanso([s(), s(), s(), s(cluster, 90)])).toBe('Cluster na série 4 · descanso 90 s');
    expect(resumoTecnicasEDescanso([s(null, 60), s(drop, 90), s(drop, 90)])).toBe('Drop-set nas séries 2 e 3 · descanso 60 a 90 s');
    expect(resumoTecnicasEDescanso([s(), s()])).toBeNull();
  });
});

// As dez prescrições do desenho aprovado: o texto vem só dos valores gravados.
const exemplo = (tipo: string | null, extra: Partial<Serie> = {}, modalidade: string | null = null) => ({ ...novaSerie(config, tipo, modalidade), ...extra });
const tecnicaDe = (tipo: Tecnica['tipo'], parte: Partial<Tecnica>) => ({ ...tecnicaVazia(tipo), ...parte });
test.each([
  ['aquecimento', [exemplo('Aquecimento')], '1x10 a 15 - Aquecimento'],
  ['3 FS', mudarQuantidade([novaSerie(config, 'FS')], agrupar([novaSerie(config, 'FS')])[0], 3, config), '3x3 - FS 50/70/85 a 90% da WS'],
  ['2 FS', [exemplo('FS', { repsMin: 3, repsMax: 5, intensidade: { modo: 'PERCENTUAL_WS', percentualMin: 70 } }), exemplo('FS', { repsMin: 3, repsMax: 5, intensidade: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: 90 } })], '2x3 a 5 - FS 70/85 a 90% da WS'],
  ['WS livre', [exemplo('WS', {}, 'LIVRE')], '1x3 a 6 - WS · 1 RIR'],
  ['WS máquina', [exemplo('WS', {}, 'MAQUINA')], '1x3 a 6 - WS · até a falha'],
  ['back off', [exemplo('Back off'), exemplo('Back off')], '2x6 a 8 - Back off 85% da WS'],
  ['rest pause só técnica', [exemplo(null, { repsMin: 8, repsMax: 8, intensidade: { modo: 'MESMA_CARGA' }, tecnica: tecnicaDe('REST_PAUSE', { pausaSegundos: 20, pausas: 1 }) })], '1x8 - Rest pause 20 s · mesma carga da WS'],
  ['3 micro-séries', [exemplo('WS', { repsMin: 4, intensidade: { modo: 'CARGA_TRABALHO' }, tecnica: tecnicaDe('REST_PAUSE', { pausaSegundos: 15, pausas: 2 }) })], '1x4 a 6 - WS + Rest pause 15 s, 2 pausas'],
  ['cluster desigual', [exemplo(null, { repsMin: 6, repsMax: 6, intensidade: { modo: 'MESMA_CARGA' }, tecnica: tecnicaDe('CLUSTER', { blocos: [4, 2], pausaSegundos: 15 }) })], '1x6 (4+2) - Cluster 15 s · mesma carga da WS'],
  ['muscle round', [exemplo(null, { repsMin: 16, repsMax: 16, intensidade: null, tecnica: tecnicaDe('CLUSTER', { blocos: [4, 4, 4, 4], pausaSegundos: 10, pausaRespiracoes: 5 }) })], '1x16 (4×4) - Cluster 5 respirações ou 10 s'],
  ['top set', [exemplo('Top set', {}, 'MAQUINA')], '1x - Top set +5 a 10% sobre a anterior'],
] as [string, Serie[], string][])('%s: resumo da prescrição', (_nome, series, esperado) => {
  expect(descreverSeries(series, config).join(' / ')).toBe(esperado);
});
