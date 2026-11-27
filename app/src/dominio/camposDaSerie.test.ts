import type { Serie } from '../api/tipos';
import {
  cargaERirIguais, dicaDasRepeticoes, DICA_DO_AMRAP, DICA_POR_TEMPO, lerDescanso, lerQuantidade, maximoDeSeriesNoGrupo, opcoesDeQuantidade,
  opcoesDoDescanso, percentuaisEmTodas, resumoDasAlternativas, resumoDosExtras, rirEmTodas, rpeEmTodas, textoCurtoDoDescanso,
} from './camposDaSerie';

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

describe('resumos das seções recolhidas', () => {
  test('extras', () => {
    expect(resumoDosExtras({ nome: 'Agachamento livre', videoUrl: null, cadencia: '3-1-1-0', isometriaSegundos: null, observacao: null }))
      .toBe('Agachamento livre · sem vídeo · cadência 3-1-1-0');
    expect(resumoDosExtras({ nome: 'Supino', videoUrl: 'https://youtu.be/x', cadencia: null, isometriaSegundos: 3, observacao: 'Pegada aberta' }))
      .toBe('Supino · com vídeo · isometria 3 s · com observação');
  });
  test('alternativas', () => {
    expect(resumoDasAlternativas([])).toBe('Nenhuma alternativa');
    expect(resumoDasAlternativas([{ exercicioId: '1', nome: 'Leg press', videoUrl: null }, { exercicioId: '2', nome: 'Hack', videoUrl: null }])).toBe('Leg press, Hack');
  });
});
