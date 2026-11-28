import type { Configuracao, Serie, TipoDeSerie } from '../api/tipos';
import {
  AJUDA_SEM_CARGA, cargaERirIguais, descansoDoClusterPendente, dicaDaCarga, dicaDasRepeticoes, DICA_DO_AMRAP, DICA_POR_TEMPO, esforcoDoGrupo,
  estimativaDaCarga, lerDescanso, lerQuantidade, maximoDeSeriesNoGrupo, MENSAGEM_DESCANSO_DO_CLUSTER, opcoesDeQuantidade, opcoesDoDescanso,
  percentuaisEmTodas, podeEscolherRpe, resumoDasAlternativas, resumoDosExtras, rirEmTodas, rpeEmTodas, textoCurtoDoDescanso,
} from './camposDaSerie';
import { sugestaoSobreReferencia } from './cargas';
import { numeroDaCarga, textoDaCarga } from './unidadeDeCarga';

const serie = (uid: string, parte: Partial<Serie> = {}): Serie => ({
  uid, tipo: 'FEEDER', repsMin: 8, repsMax: 10, amrap: null, carga: { modo: 'PERCENTUAL_WS', percentualMin: 50, percentualMax: null },
  esforco: null, descansoSegundos: 90, tecnica: null, cardio: null, alvoExtra: null, ...parte,
});

describe('séries: "Digite ou escolha"', () => {
  test('o máximo do grupo é o que sobra do limite do exercício', () => {
    expect(maximoDeSeriesNoGrupo(5, 2, 30)).toBe(27);
    expect(maximoDeSeriesNoGrupo(30, 1, 30)).toBe(1);
  });
  test('oferece de 1 a 10 (ou até o máximo) e o atual acima de 10', () => {
    expect(opcoesDeQuantidade(3, 30).map((o) => o.valor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(opcoesDeQuantidade(2, 4).map((o) => o.valor)).toEqual([1, 2, 3, 4]);
    expect(opcoesDeQuantidade(12, 30).map((o) => o.valor).at(-1)).toBe(12);
  });
  test('lê só inteiros de 1 ao máximo', () => {
    expect(lerQuantidade(' 12 ', 30)).toBe(12);
    expect(lerQuantidade('0', 30)).toBeNull();
    expect(lerQuantidade('31', 30)).toBeNull();
    expect(lerQuantidade('2,5', 30)).toBeNull();
    expect(lerQuantidade('três', 30)).toBeNull();
  });
});

describe('descanso: "Digite ou escolha"', () => {
  test.each([['75', 75], ['75 s', 75], ['1:30', 90], ['2 min', 120], ['2min', 120], ['1 min 30', 90], ['1 min 30 s', 90], ['0', 0], ['3600', 3600]])('lê "%s"', (t, s) => {
    expect(lerDescanso(t as string)).toBe(s);
  });
  test.each(['', 'abc', '3601', '61:00', '1:75', '1,5'])('recusa "%s"', (t) => expect(lerDescanso(t)).toBeNull());
  test('formato curto', () => {
    expect(textoCurtoDoDescanso(45)).toBe('45 s');
    expect(textoCurtoDoDescanso(90)).toBe('90 s');
    expect(textoCurtoDoDescanso(120)).toBe('2 min');
    expect(textoCurtoDoDescanso(150)).toBe('2 min 30 s');
  });
  test('as prontas e o gravado fora delas, em ordem', () => {
    expect(opcoesDoDescanso(90).map((o) => o.rotulo)).toEqual(['45 s', '60 s', '90 s', '2 min', '3 min']);
    expect(opcoesDoDescanso(75).map((o) => o.valor)).toEqual([45, 60, 75, 90, 120, 180]);
    expect(opcoesDoDescanso(null)).toHaveLength(5);
  });
});

describe('dica das repetições (uma linha)', () => {
  test('tabela forma × estado', () => {
    expect(dicaDasRepeticoes('AMRAP', {}, true)).toBe(DICA_DO_AMRAP);
    expect(dicaDasRepeticoes('FAIXA', {}, true)).toBe(DICA_POR_TEMPO);
    expect(dicaDasRepeticoes('EXATA', {}, true)).toBe(DICA_POR_TEMPO);
    expect(dicaDasRepeticoes('FAIXA', { repsMin: 8 }, true)).toBe('Preencha mín. e máx.');
    expect(dicaDasRepeticoes('FAIXA', {}, false)).toBe('Preencha mín. e máx.');
    expect(dicaDasRepeticoes('EXATA', {}, false)).toBe('Informe as repetições');
    expect(dicaDasRepeticoes('FAIXA', { repsMin: 8, repsMax: 10 }, true)).toBeNull();
    expect(dicaDasRepeticoes('EXATA', { repsMin: 8, repsMax: 8 }, false)).toBeNull();
  });
});

describe('carga e RIR: mesmo valor para todas', () => {
  const series = [serie('a'), serie('b'), serie('c', { tipo: 'WORKING' })];
  const g = { inicio: 0, series: series.slice(0, 2) };
  test('iguais quando % e esforço batem', () => {
    expect(cargaERirIguais(g)).toBe(true);
    expect(cargaERirIguais({ inicio: 0, series: [serie('a'), serie('b', { esforco: { rir: 2, rpe: null } })] })).toBe(false);
  });
  test('o % e o RIR vão para todas as séries do grupo, e só delas', () => {
    const p = percentuaisEmTodas(series, g, 60, 70, 'PREPARACAO');
    expect(p.map((s) => s.carga?.percentualMin)).toEqual([60, 60, 50]);
    const r = rirEmTodas(series, g, 2);
    expect(r.map((s) => s.esforco?.rir ?? null)).toEqual([2, 2, null]);
    expect(rpeEmTodas(series, g, 8).map((s) => s.esforco?.rpe ?? null)).toEqual([8, 8, null]);
  });
  test('no aquecimento, em branco é sem sugestão em todas', () => {
    expect(percentuaisEmTodas(series, g, null, null, 'AQUECIMENTO').map((s) => s.carga)).toEqual([null, null, series[2].carga]);
  });
});

describe('dica da carga', () => {
  const tipo = (codigo: string, nome: string, papel: TipoDeSerie['papel']): TipoDeSerie => ({
    codigo, nome, papel, repeticoes: null, cargaPadrao: null, esforcoPadrao: null, regraPercentuais: null, explicacao: null,
  });
  const config = { tipos: [tipo('WARMUP', 'Aquecimento', 'AQUECIMENTO'), tipo('FEEDER', 'FS', 'PREPARACAO'), tipo('WORKING', 'WS', 'TRABALHO')], arredondamentoKg: 1 } as Configuracao;
  const pct = (min: number | null, max: number | null, tipo = 'WARMUP') => serie('x', { tipo, carga: { modo: 'PERCENTUAL_WS', percentualMin: min, percentualMax: max } });

  test('estimativa pela conta da sugestão ao aluno (mesmo arredondamento)', () => {
    expect(estimativaDaCarga(pct(50, 60), 90, 1, 'kg')).toBe('≈ 45 a 54 kg com WS de 90 kg');
    expect(estimativaDaCarga(pct(50, 60), 90, 2.5, 'kg')).toBe('≈ 45 a 55 kg com WS de 90 kg');
    expect(estimativaDaCarga(pct(50, 60), 90, 2.5, 'kg')).toBe(`≈ ${sugestaoSobreReferencia(pct(50, null), 90, 2.5)} a ${sugestaoSobreReferencia(pct(60, null), 90, 2.5)} kg com WS de 90 kg`);
    expect(estimativaDaCarga(pct(50, null), 90, 1, 'kg')).toBe('≈ 45 kg com WS de 90 kg');
    expect(estimativaDaCarga(pct(50, 51), 90, 2.5, 'kg')).toBe('≈ 45 kg com WS de 90 kg');
  });
  test('em libra, os números e a unidade da tela', () => {
    expect(estimativaDaCarga(pct(50, 60), 90, 1, 'lb')).toBe(`≈ ${numeroDaCarga(45, 'lb')} a ${numeroDaCarga(54, 'lb')} lb com WS de ${textoDaCarga(90, 'lb')}`);
  });
  test('sem WS, sem percentual ou fora de % da WS: nada', () => {
    expect(estimativaDaCarga(pct(50, 60), null, 1, 'kg')).toBeNull();
    expect(estimativaDaCarga(pct(50, 60), 0, 1, 'kg')).toBeNull();
    expect(estimativaDaCarga(pct(null, null), 90, 1, 'kg')).toBeNull();
    expect(estimativaDaCarga(serie('x', { carga: { modo: 'CARGA_FIXA', valorKg: 40 } }), 90, 1, 'kg')).toBeNull();
    expect(estimativaDaCarga(serie('x', { carga: null }), 90, 1, 'kg')).toBeNull();
  });
  test('dica: estimativa · ajuda do aquecimento, com o nome da WS da metodologia', () => {
    expect(dicaDaCarga(pct(50, 60), { config, unidade: 'kg', wsKg: 90 })).toBe(`≈ 45 a 54 kg com WS de 90 kg · ${AJUDA_SEM_CARGA}`);
    expect(dicaDaCarga(pct(50, 60), { config, unidade: 'kg', wsKg: null })).toBe(AJUDA_SEM_CARGA);
    expect(dicaDaCarga(pct(null, null), { config, unidade: 'kg', wsKg: 90 })).toBe(AJUDA_SEM_CARGA);
    expect(dicaDaCarga(pct(50, 60, 'FEEDER'), { config, unidade: 'kg', wsKg: 90 })).toBe('≈ 45 a 54 kg com WS de 90 kg');
    expect(dicaDaCarga(pct(50, 60, 'FEEDER'), { config, unidade: 'kg', wsKg: null })).toBeNull();
    expect(dicaDaCarga(serie('x', { tipo: 'WORKING', carga: { modo: 'CARGA_TRABALHO' } }), { config, unidade: 'kg', wsKg: 90 })).toBeNull();
  });
});

describe('esforço: RIR ou RPE', () => {
  test('a troca só na série de trabalho, ou com RPE gravado', () => {
    expect(podeEscolherRpe('TRABALHO', false)).toBe(true);
    expect(podeEscolherRpe('AQUECIMENTO', false)).toBe(false);
    expect(podeEscolherRpe('PREPARACAO', false)).toBe(false);
    expect(podeEscolherRpe(null, false)).toBe(false);
    expect(podeEscolherRpe('AQUECIMENTO', true)).toBe(true);
  });
  test('abre em RPE se alguma série do grupo tem RPE', () => {
    expect(esforcoDoGrupo({ inicio: 0, series: [serie('a'), serie('b', { esforco: { rir: 2, rpe: null } })] })).toBe('RIR');
    expect(esforcoDoGrupo({ inicio: 0, series: [serie('a'), serie('b', { esforco: { rir: null, rpe: 8 } })] })).toBe('RPE');
  });
});

describe('descanso do cluster', () => {
  const cluster = (descansoSegundos: number | null) => serie('x', { descansoSegundos, tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15 } });
  test('cluster sem descanso é pendente; com descanso (0 inclusive) não', () => {
    expect(descansoDoClusterPendente(cluster(null))).toBe(true);
    expect(descansoDoClusterPendente(cluster(180))).toBe(false);
    expect(descansoDoClusterPendente(cluster(0))).toBe(false);
    expect(MENSAGEM_DESCANSO_DO_CLUSTER).toBe('Defina o descanso. Sem ele, o aluno não tem o timer entre as séries.');
  });
  test('outra técnica, ou nenhuma, nunca é pendente', () => {
    expect(descansoDoClusterPendente(serie('x', { descansoSegundos: null, tecnica: { tipo: 'REST_PAUSE', pausaSegundos: 15 } }))).toBe(false);
    expect(descansoDoClusterPendente(serie('x', { descansoSegundos: null }))).toBe(false);
  });
});

describe('resumos das seções recolhidas', () => {
  test('extras', () => {
    expect(resumoDosExtras({ nome: 'Agachamento livre', videoUrl: null, cadencia: '3-1-1-0', isometriaSegundos: null, observacao: null }))
      .toBe('Agachamento livre · sem vídeo · cadência 3-1-1-0');
    expect(resumoDosExtras({ nome: 'Supino', videoUrl: 'https://youtu.be/x', cadencia: null, isometriaSegundos: 3, observacao: 'Pegada aberta' }))
      .toBe('Supino · com vídeo · sem cadência · isometria 3 s · com observação');
  });
  test('alternativas', () => {
    expect(resumoDasAlternativas([])).toBe('Nenhuma alternativa');
    expect(resumoDasAlternativas([{ exercicioId: '1', nome: 'Leg press', videoUrl: null }, { exercicioId: '2', nome: 'Hack', videoUrl: null }])).toBe('Leg press, Hack');
  });
});
