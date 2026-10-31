import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { novaSerie, mudarQuantidade, tecnicaVazia } from './editorTreino';
import type { Serie, Tecnica } from '../api/tipos';
import { agrupar, descreverSeries, leituraDaTecnica, resumoTecnicasEDescanso, tecnicasDoExercicio, textoCardio, textoCarga, textoEsforco, textosDeTecnica, textoTecnica, textoTecnicaPorExtenso } from './agrupamento';
import { carga, rir, rpe, serie as serieDeTeste } from './exemplosDeTreino.apoioTeste';

const cluster: Tecnica = { ...tecnicaVazia('CLUSTER'), blocos: [2, 2, 2], pausaSegundos: 20 };
const restPause: Tecnica = { ...tecnicaVazia('REST_PAUSE'), pausaSegundos: 20, pausas: 2 };
const dropSet: Tecnica = { ...tecnicaVazia('DROP_SET'), quedas: 2, reducaoPercentual: 20 };

const serie = (uid: string, tecnica: Tecnica | null = null): Serie => serieDeTeste(uid, { tipo: 'WORKING', tecnica });

describe('técnica da série (reunião de 17/10)', () => {
  it('texto curto do editor e do PDF', () => {
    expect(textoTecnica(cluster)).toBe('Cluster 3×2, 20 s');
    expect(textoTecnica(restPause)).toBe('Rest pause 20 s, 2 pausas');
    expect(textoTecnica({ ...restPause, pausas: 1 })).toBe('Rest pause 20 s');
    expect(textoTecnica(null)).toBe('');
  });

  it('texto por extenso para o aluno, sem inventar número', () => {
    expect(textoTecnicaPorExtenso(cluster)).toBe('Cluster: faça 3 blocos de 2 repetições. São 6 repetições previstas no total e 2 pausas internas. Encerre ao terminar o 3º bloco. Pausa entre os blocos: 20 s.');
    expect(textoTecnicaPorExtenso(restPause)).toBe('Rest pause: depois da série, 20 s de pausa e continue com a mesma carga até a falha, 2 vezes.');
    expect(textoTecnicaPorExtenso({ ...restPause, pausas: 1 })).toBe('Rest pause: depois da série, 20 s de pausa e continue com a mesma carga até a falha.');
    expect(textoTecnicaPorExtenso({ ...cluster, blocos: null })).toBe('Cluster: complete os blocos para visualizar a prescrição.');
  });

  it('séries com técnicas diferentes não se juntam no mesmo grupo, e o resumo diz a técnica', () => {
    const series = [serie('a'), serie('b', cluster), serie('c', cluster)];
    expect(agrupar(series).map((g) => g.series.length)).toEqual([1, 2]);
    expect(descreverSeries(series, config)).toEqual(['1x6 - WS', '2x6 (3×2) - WS com Cluster 20 s']);
  });

  it('cada técnica traz a pausa para o botão do cronômetro', () => {
    expect(tecnicasDoExercicio([serie('a', cluster), serie('b', cluster), serie('c', restPause), serie('d')]).map((t) => t.pausaSegundos)).toEqual([cluster.pausaSegundos, restPause.pausaSegundos]);
    expect(tecnicasDoExercicio([serie('a', { ...cluster, pausaSegundos: null })])[0].pausaSegundos).toBeNull();
  });

  it('o aluno lê cada técnica uma vez', () => {
    expect(textosDeTecnica([serie('a', cluster), serie('b', cluster), serie('c', restPause), serie('d')], config)).toEqual([
      leituraDaTecnica(serie('a', cluster), config),
      leituraDaTecnica(serie('c', restPause), config),
    ]);
    expect(leituraDaTecnica(serie('a', cluster), config)).toBe('WS com Cluster. Faça 3 blocos de 2 repetições. São 6 repetições previstas no total e 2 pausas internas. Encerre ao terminar o 3º bloco. Pausa entre os blocos: 20 s. Descanso depois da série: não informado. A sugestão de carga vem da base do dia. Ajuste a carga desta série.');
  });

  it('não repete o descanso da série quando ele é do grupo, nem pede carga no exercício sem carga', () => {
    const comDescanso = serieDeTeste('a', { tipo: 'WORKING', tecnica: cluster, descansoSegundos: 90 });
    const solta = leituraDaTecnica(comDescanso, config);
    expect(solta).toContain('Pausa entre os blocos: 20 s.');
    expect(solta).toContain('Descanso depois da série: 90 s.');
    expect(solta).toContain('Ajuste a carga desta série.');
    const noGrupo = leituraDaTecnica(comDescanso, config, { descansoPorSerie: false });
    expect(noGrupo).toContain('Pausa entre os blocos: 20 s.');
    expect(noGrupo).not.toContain('Descanso depois da série');
    expect(noGrupo).toContain('Ajuste a carga desta série.');
    const semCarga = leituraDaTecnica(comDescanso, config, { semCarga: true });
    expect(semCarga).toContain('Descanso depois da série: 90 s.');
    expect(semCarga).not.toContain('Ajuste a carga');
    expect(semCarga).not.toContain('base do dia');
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
    expect(textoTecnicaPorExtenso({ ...dropSet, quedas: 1, repsPorQueda: 6 })).toBe('Drop-set: ao terminar, reduza a carga cerca de 20% e faça mais 6 repetições, 1 vez.');
  });

  it('não tem pausa para o cronômetro e não se junta a série simples nem a outra técnica', () => {
    expect(tecnicasDoExercicio([serie('a', dropSet)])[0].pausaSegundos).toBeNull();
    expect(agrupar([serie('a'), serie('b', dropSet), serie('c', dropSet), serie('d', cluster)]).map((g) => g.series.length)).toEqual([1, 2, 1]);
    expect(descreverSeries([serie('a', dropSet)], config)).toEqual(['1x6 - WS + Drop-set 2× −20%']);
  });
});

describe('novas técnicas', () => {
  it('myo-reps, partial reps e forced reps: texto curto e por extenso', () => {
    const myo: Tecnica = { ...tecnicaVazia('MYO_REPS'), miniSeries: 4, repsPorMiniSerie: 5, pausaRespiracoes: 5 };
    const parciais: Tecnica = { ...tecnicaVazia('PARTIAL_REPS'), repsParciais: 5, regiao: 'ALONGADA' };
    const forcadas: Tecnica = { ...tecnicaVazia('FORCED_REPS'), repsAssistidas: 2 };
    expect(textoTecnica(myo)).toBe('Myo-reps 4×5, 5 respirações');
    expect(textoTecnica(parciais)).toBe('Partial reps 5 alongadas');
    expect(textoTecnica(forcadas)).toBe('Forced reps 2 assistidas');
    expect(textoTecnicaPorExtenso(myo)).toContain('4 mini-séries de 5 repetições');
    expect(textoTecnicaPorExtenso(parciais)).toContain('na parte alongada do movimento');
    expect(textoTecnicaPorExtenso(forcadas)).toContain('um parceiro');
  });
});

describe('carga e esforço em texto', () => {
  it('cada forma de carga diz a base, e carga de trabalho não diz nada', () => {
    expect(textoCarga(carga('PERCENTUAL_WS', 85, 90), 'WS')).toBe('85% a 90% da WS');
    expect(textoCarga(carga('ACIMA_DA_ANTERIOR', 1, 5))).toBe('+1% a 5% sobre a anterior');
    expect(textoCarga(carga('MESMA_CARGA'), 'WS')).toBe('mesma carga da WS');
    expect(textoCarga(carga('ABAIXO_DA_REFERENCIA', 15, null, 'x'), 'WS', 'Top set')).toBe('15% abaixo da referência (Top set)');
    expect(textoCarga(carga('CARGA_TRABALHO'))).toBe('');
    expect(textoCarga(null)).toBe('');
  });

  it('RIR 0 é até a falha, RPE sai com o valor, vazio sai vazio', () => {
    expect(textoEsforco(rir(1))).toBe('1 RIR');
    expect(textoEsforco(rir(0))).toBe('até a falha');
    expect(textoEsforco(rpe(8.5))).toBe('RPE 8,5');
    expect(textoEsforco(null)).toBe('');
  });

  it('cardio: duração, distância, ritmo, zona e intervalos', () => {
    expect(textoCardio({ duracaoMin: 30, distanciaKm: 5, ritmo: '6:00', zona: 2 })).toBe('30 min · 5 km · ritmo 6:00 · zona 2');
    expect(textoCardio({ intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } })).toBe('8× 30 s / 60 s de descanso');
    expect(textoCardio(null)).toBe('—');
  });
});

describe('resumo de técnicas e descanso na lista do dia', () => {
  const s = (tecnica?: Tecnica | null, descansoSegundos: number | null = null): Serie => serieDeTeste('x', { repsMin: 6, repsMax: 8, carga: null, descansoSegundos, tecnica: tecnica ?? null });
  const clusterDoDia: Tecnica = { ...tecnicaVazia('CLUSTER'), blocos: [4, 4, 4], pausaSegundos: 20 };
  const drop: Tecnica = { ...tecnicaVazia('DROP_SET'), quedas: 2 };
  it('diz a série de cada técnica e o descanso', () => {
    expect(resumoTecnicasEDescanso([s(), s(), s(), s(clusterDoDia, 90)])).toBe('Cluster na série 4 · descanso 90 s');
    expect(resumoTecnicasEDescanso([s(null, 60), s(drop, 90), s(drop, 90)])).toBe('Drop-set nas séries 2 e 3 · descanso 60 a 90 s');
    expect(resumoTecnicasEDescanso([s(), s()])).toBeNull();
  });
});

// As prescrições do desenho aprovado: o texto vem só dos valores gravados (Serie.tipo é o CÓDIGO do tipo).
const exemplo = (codigo: string | undefined, extra: Partial<Serie> = {}, modalidade: string | null = null): Serie => ({ ...novaSerie(config, codigo, modalidade), ...extra });
const tecnicaDe = (tipo: Tecnica['tipo'], parte: Partial<Tecnica>) => ({ ...tecnicaVazia(tipo), ...parte });
const tresFs = () => {
  const primeira = novaSerie(config, 'FEEDER');
  return mudarQuantidade([primeira], agrupar([primeira])[0], 3, config);
};
test.each([
  ['aquecimento', [exemplo('WARM_UP')], '1x10 a 15 - Aquecimento'],
  ['3 FS', tresFs(), '3x3 - FS 50% · 70% · 85% a 90% da WS'],
  [
    '2 FS',
    [
      exemplo('FEEDER', { repsMin: 3, repsMax: 5, carga: carga('PERCENTUAL_WS', 70) }),
      exemplo('FEEDER', { repsMin: 3, repsMax: 5, carga: carga('PERCENTUAL_WS', 85, 90) }),
    ],
    '2x3 a 5 - FS 70% · 85% a 90% da WS',
  ],
  ['WS livre', [exemplo('WORKING', {}, 'LIVRE')], '1x3 a 6 - WS · 1 RIR'],
  ['WS máquina', [exemplo('WORKING', {}, 'MAQUINA')], '1x3 a 6 - WS · até a falha'],
  ['back off', [exemplo('BACK_OFF'), exemplo('BACK_OFF')], '2x6 a 8 - Back off 85% da WS'],
  ['rest pause só técnica', [exemplo(undefined, { tipo: null, repsMin: 8, repsMax: 8, carga: carga('MESMA_CARGA'), esforco: null, tecnica: tecnicaDe('REST_PAUSE', { pausaSegundos: 20, pausas: 1 }) })], '1x8 - Rest pause 20 s · mesma carga da WS'],
  ['3 micro-séries', [exemplo('WORKING', { repsMin: 4, esforco: null, tecnica: tecnicaDe('REST_PAUSE', { pausaSegundos: 15, pausas: 2 }) })], '1x4 a 6 - WS + Rest pause 15 s, 2 pausas'],
  ['cluster desigual', [exemplo(undefined, { tipo: null, repsMin: 6, repsMax: 6, carga: carga('MESMA_CARGA'), esforco: null, tecnica: tecnicaDe('CLUSTER', { blocos: [4, 2], pausaSegundos: 15 }) })], '1x6 (4+2) - Cluster 15 s · mesma carga da WS'],
  ['muscle round', [exemplo(undefined, { tipo: null, repsMin: 16, repsMax: 16, carga: null, esforco: null, tecnica: tecnicaDe('CLUSTER', { blocos: [4, 4, 4, 4], pausaSegundos: 10, pausaRespiracoes: 5 }) })], '1x16 (4×4) - Cluster 5 respirações ou 10 s'],
  ['top set', [exemplo('TOP_SET', {}, 'MAQUINA')], '1x - Top set +5% a 10% sobre a anterior'],
  ['AMRAP', [exemplo('WORKING', { repsMin: null, repsMax: null, amrap: true, esforco: null })], '1xAMRAP - WS'],
] as [string, Serie[], string][])('%s: resumo da prescrição', (_nome, series, esperado) => {
  expect(descreverSeries(series, config).join(' / ')).toBe(esperado);
});

describe('back off com referência', () => {
  it('diz o nome do tipo da série de referência, e séries com referências diferentes não se juntam', () => {
    const top = serieDeTeste('top', { tipo: 'TOP_SET', repsMin: null, repsMax: null, carga: carga('ACIMA_DA_ANTERIOR', 1, 5) });
    const a = serieDeTeste('a', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'top') });
    const b = serieDeTeste('b', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'top') });
    const c = serieDeTeste('c', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('ABAIXO_DA_REFERENCIA', 15, null, 'a') });
    expect(descreverSeries([top, a, b], config)).toEqual(['1x - Top set +1% a 5% sobre a anterior', '2x6 a 8 - Back off 15% abaixo da referência (Top set)']);
    expect(agrupar([top, a, b, c]).map((g) => g.series.length)).toEqual([1, 2, 1]);
  });
});

describe('cardio', () => {
  it('o resumo do grupo é a prescrição de cardio', () => {
    const c = serieDeTeste('c', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20, zona: 2 } });
    expect(descreverSeries([c, { ...c, uid: 'd' }], config)).toEqual(['2x 20 min · zona 2']);
  });
});
