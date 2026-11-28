import type { Serie } from '../api/tipos';
import type { GrupoDeSeries } from './agrupamento';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { exercicioDaPrevia, legendaDaPrevia, seriesDaPrevia, wsDeReferenciaKg } from './previaDaSerie';

const ws = (uid: string, parte: Partial<Serie> = {}): Serie => ({
  uid, tipo: 'WORKING', repsMin: 6, repsMax: 8, amrap: null, carga: { modo: 'CARGA_TRABALHO' },
  esforco: null, descansoSegundos: 60, tecnica: null, cardio: null, alvoExtra: null, ...parte,
});
const comRir = (rirs: number[], inicio = 0): GrupoDeSeries => ({ inicio, series: rirs.map((rir, i) => ws(`s${i}`, { esforco: { rir } })) });
const ctx = { unidade: 'kg' as const, wsKg: null };
const DESCANSO = 'Descanso de 60 s depois da série';
/** O total do exercício é o fim do grupo, salvo quando o teste diz outro. */
const legenda = (g: GrupoDeSeries, extra: { max?: number; totalDoExercicio?: number } = {}) =>
  legendaDaPrevia(g, CONFIGURACAO_PADRAO, { ...ctx, totalDoExercicio: g.inicio + g.series.length, ...extra });

describe('seriesDaPrevia', () => {
  test('séries iguais: um cartão só', () => {
    expect(seriesDaPrevia(comRir([2, 2, 2, 2]))).toEqual({ indices: [0], ocultas: [1, 2, 3] });
  });
  test('uma por prescrição distinta, até 3', () => {
    expect(seriesDaPrevia(comRir([2, 2, 1, 1, 0, 0]))).toEqual({ indices: [0, 2, 4], ocultas: [1, 3, 5] });
    expect(seriesDaPrevia(comRir([4, 3, 2, 1]))).toEqual({ indices: [0, 1, 2], ocultas: [3] });
    expect(seriesDaPrevia(comRir([2, 1, 0]), 1)).toEqual({ indices: [0], ocultas: [1, 2] });
  });
  test('a carga também separa (forma, % e kg)', () => {
    const g: GrupoDeSeries = { inicio: 0, series: [
      ws('a', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 70 } }),
      ws('b', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 70 } }),
      ws('c', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 80 } }),
      ws('d', { carga: { modo: 'NENHUMA' } }),
    ] };
    expect(seriesDaPrevia(g)).toEqual({ indices: [0, 2, 3], ocultas: [1] });
  });
  test('índices do exercício: o grupo depois de duas séries começa no 2', () => {
    expect(seriesDaPrevia(comRir([2, 1], 2))).toEqual({ indices: [2, 3], ocultas: [] });
  });
});

describe('legendaDaPrevia', () => {
  test('séries iguais: só a 1ª linha', () => {
    expect(legenda(comRir([2, 2, 2]))).toEqual([DESCANSO]);
  });
  test('RIR 2,2,1,1,0,0 com 3 cartões: todas as ocultas repetem um cartão, sem 2ª linha', () => {
    expect(legenda(comRir([2, 2, 1, 1, 0, 0]))).toEqual([DESCANSO]);
  });
  test('RIR 2,2,1,1,0,0 com 1 cartão: a frase do documento', () => {
    expect(legenda(comRir([2, 2, 1, 1, 0, 0]), { max: 1 })).toEqual([
      DESCANSO,
      'Mostrando a série 1 de 6. As séries 3 e 4 aparecem com RIR 1; 5 e 6 com RIR 0.',
    ]);
  });
  test('uma oculta: singular; vários cartões: plural', () => {
    expect(legenda(comRir([4, 3, 2, 1]))[1]).toBe('Mostrando as séries 1, 2 e 3 de 4. A série 4 aparece com RIR 1.');
    expect(legenda(comRir([3, 2, 1, 0]), { max: 2 })[1])
      .toBe('Mostrando as séries 1 e 2 de 4. A série 3 aparece com RIR 1; 4 com RIR 0.');
  });
  test('números do exercício quando o grupo não é o primeiro', () => {
    expect(legenda(comRir([2, 1, 1], 2), { max: 1 })[1]).toBe('Mostrando a série 3 de 5. As séries 4 e 5 aparecem com RIR 1.');
  });
  test('RPE e carga diferente entram no texto', () => {
    const g: GrupoDeSeries = { inicio: 0, series: [
      ws('a', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 70 }, esforco: { rpe: 8 } }),
      ws('b', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 80 }, esforco: { rpe: 8.5 } }),
    ] };
    expect(legenda(g, { max: 1 })).toEqual([
      `${DESCANSO} · carga sugerida a partir da WS do dia`,
      'Mostrando a série 1 de 2. A série 2 aparece com 80% da WS · RPE 8,5.',
    ]);
  });
  test('em % sem descanso: maiúscula na carga; sem descanso nem %: nada', () => {
    const g: GrupoDeSeries = { inicio: 0, series: [ws('a', { descansoSegundos: null, carga: { modo: 'PERCENTUAL_WS', percentualMin: 70 } })] };
    expect(legenda(g)).toEqual(['Carga sugerida a partir da WS do dia']);
    expect(legenda({ inicio: 0, series: [ws('a', { descansoSegundos: 0 })] })).toEqual([]);
  });
  test('"de N" é o total do exercício, não o do grupo', () => {
    expect(legenda(comRir([2, 1]), { max: 1, totalDoExercicio: 7 })[1]).toBe('Mostrando a série 1 de 7. A série 2 aparece com RIR 1.');
  });
  test('sem descanso nem %: a 2ª linha sai sozinha', () => {
    const g: GrupoDeSeries = { inicio: 0, series: [2, 2, 1, 0].map((rir, i) => ws(`s${i}`, { descansoSegundos: null, esforco: { rir } })) };
    expect(legenda(g, { max: 2 })).toEqual(['Mostrando as séries 1 e 3 de 4. A série 4 aparece com RIR 0.']);
  });
  test('cluster: a mesma legenda, com o descanso em minutos', () => {
    const tecnica = { tipo: 'CLUSTER' as const, blocos: [5, 5, 5], pausaSegundos: 15 };
    const g: GrupoDeSeries = { inicio: 0, series: [0, 0, 1].map((rir, i) => ws(`c${i}`, { descansoSegundos: 180, tecnica, esforco: { rir } })) };
    expect(legenda(g, { max: 1 })).toEqual([
      'Descanso de 3 min depois da série',
      'Mostrando a série 1 de 3. A série 3 aparece com RIR 1.',
    ]);
  });
});

describe('exercicioDaPrevia', () => {
  test('todas as séries, sem dado do aluno, e a unidade pelo "sem carga"', () => {
    const series = [ws('a'), ws('b')];
    const e = exercicioDaPrevia(series, false);
    expect(e.series).toBe(series);
    expect(e).toMatchObject({ exercicioId: null, unidade: 'kg', progressao: true, videoUrl: null, observacao: null });
    expect(exercicioDaPrevia(series, true).unidade).toBe('nenhuma');
  });
});

describe('wsDeReferenciaKg', () => {
  test('a carga fixa da série de trabalho', () => {
    const series = [ws('fs', { tipo: 'FEEDER', carga: { modo: 'CARGA_FIXA', valorKg: 40 } }), ws('w', { carga: { modo: 'CARGA_FIXA', valorKg: 90 } })];
    expect(wsDeReferenciaKg(series, CONFIGURACAO_PADRAO)).toBe(90);
  });
  test('sem WS fixa: null', () => {
    expect(wsDeReferenciaKg([ws('w')], CONFIGURACAO_PADRAO)).toBeNull();
    expect(wsDeReferenciaKg([ws('w', { carga: { modo: 'CARGA_FIXA', valorKg: null } })], CONFIGURACAO_PADRAO)).toBeNull();
    expect(wsDeReferenciaKg([ws('fs', { tipo: 'FEEDER', carga: { modo: 'CARGA_FIXA', valorKg: 40 } })], CONFIGURACAO_PADRAO)).toBeNull();
    expect(wsDeReferenciaKg([], CONFIGURACAO_PADRAO)).toBeNull();
  });
});
