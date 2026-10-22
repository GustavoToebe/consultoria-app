import type { ExercicioPlano, Serie } from '../api/tipos';
import { ajustarCarga, arredondar, calcularCargasDoExercicio, metaDaSerie, passoDaCarga, usaCargaDeTrabalho } from './cargas';

const serie = (uid: string, tipo: string, extra: Partial<Serie>): Serie => ({
  uid,
  tipo,
  repsMin: 3,
  repsMax: 3,

  intensidade: null,
  descansoSegundos: null,
  ...extra,
});
const fs = (uid: string, p: number) => serie(uid, 'FS', { intensidade: { modo: 'PERCENTUAL_WS', percentualMin: p } });
const ws = (uid: string) => serie(uid, 'WS', { repsMax: 6, intensidade: { modo: 'CARGA_TRABALHO' } });
const backOff = (uid: string, p: number) =>
  serie(uid, 'Back off', { repsMin: 6, repsMax: 8, intensidade: { modo: 'PERCENTUAL_WS', percentualMin: p } });

const exercicio = (series: Serie[], extra: Partial<ExercicioPlano> = {}): ExercicioPlano => ({
  uid: 'e',
  exercicioId: 'x',
  nome: 'Remada',
  modalidade: 'MAQUINA',
  videoUrl: null,
  observacao: null,
  progressao: true,
  unidade: 'kg',
  series,
  ...extra,
});

const CONFIG = { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };

describe('cargas do aluno', () => {
  it('FS 50/70/85 com base 30 → 15/21/25,5', () => {
    const r = calcularCargasDoExercicio(exercicio([fs('a', 50), fs('b', 70), fs('c', 85), ws('d')]), 30, {}, CONFIG);
    expect(r.map((x) => x.sugestao)).toEqual([15, 21, 25.5, 30]);
  });

  it('back off 90% depois de WS registrada em 32 → 29 (28,8 arredondado)', () => {
    const r = calcularCargasDoExercicio(exercicio([ws('d'), backOff('e', 90)]), 30, { d: 32 }, CONFIG);
    expect(r[1].sugestao).toBe(29);
  });

  it('WS não registrada: back off usa a base', () => {
    const r = calcularCargasDoExercicio(exercicio([ws('d'), backOff('e', 90)]), 30, {}, CONFIG);
    expect(r[1].sugestao).toBe(27);
  });

  it('arredondamento de 0,25', () => {
    expect(arredondar(28.8, 0.25)).toBe(28.75);
    expect(arredondar(25.5, 2.5)).toBe(25);
  });

  it('sem base nem registro não há sugestão (não inventa)', () => {
    const r = calcularCargasDoExercicio(exercicio([fs('a', 50), ws('d')]), null, {}, CONFIG);
    expect(r.map((x) => x.sugestao)).toEqual([null, null]);
  });

  it('sem carga (elástico) não sugere nada', () => {
    const r = calcularCargasDoExercicio(exercicio([ws('d')], { unidade: 'nenhuma' }), 30, {}, CONFIG);
    expect(r[0].sugestao).toBeNull();
    expect(r[0].meta).toBe('Meta: 3 a 6 reps');
  });

  it('meta em texto, sem parse de faixa', () => {
    expect(metaDaSerie(fs('a', 50), 'WS')).toBe('Meta: 3 reps · 50% da WS');
    expect(metaDaSerie(ws('d'), 'WS')).toBe('Meta: 3 a 6 reps · carga de trabalho');
    expect(metaDaSerie(serie('r', 'Série', { repsMin: 8, repsMax: 12, intensidade: { modo: 'NENHUMA', rir: 1 } }), 'WS')).toBe(
      'Meta: 8 a 12 reps · 1 RIR',
    );
    expect(metaDaSerie(serie('c', 'Cardio', { repsMin: null, repsMax: null, }), 'WS')).toBe('Meta: —');
  });
});


describe('drop-set', () => {
  it('a sugestão é a carga de começo da série; a redução fica só no texto, sem calcular a carga das quedas', () => {
    const drop = serie('d', 'WS', {
      repsMax: 6,
      intensidade: { modo: 'CARGA_TRABALHO' },
      tecnica: { tipo: 'DROP_SET', blocos: null, pausaSegundos: null, pausaRespiracoes: null, pausas: null, quedas: 2, reducaoPercentual: 20, repsPorQueda: null },
    });
    const [r] = calcularCargasDoExercicio(exercicio([drop]), 30, {}, CONFIG);
    expect(r.sugestao).toBe(30);
    expect(r.meta).toBe('Meta: 3 a 6 reps · carga de trabalho · Drop-set 2× −20%');
  });
});

describe('botões + e − da carga', () => {
  it('o passo é o arredondamento da metodologia; sem carga ou passo inválido, sem botões', () => {
    expect(passoDaCarga({ unidade: 'kg' }, 2.5)).toBe(2.5);
    expect(passoDaCarga({ unidade: 'nenhuma' }, 2.5)).toBeNull();
    expect(passoDaCarga({ unidade: 'kg' }, 0)).toBeNull();
    expect(passoDaCarga({ unidade: 'kg' }, -1)).toBeNull();
    expect(passoDaCarga({ unidade: 'kg' }, Number.NaN)).toBeNull();
  });

  it('anda de passo em passo a partir do digitado, da sugestão ou do zero, sem erro de ponto flutuante', () => {
    expect(ajustarCarga(20, null, 2.5, 1)).toBe(22.5);
    expect(ajustarCarga(20, 40, 2.5, -1)).toBe(17.5);
    expect(ajustarCarga(null, 40, 2.5, 1)).toBe(42.5);
    expect(ajustarCarga(null, null, 0.25, 1)).toBe(0.25);
    expect(ajustarCarga(0.1, null, 0.2, 1)).toBe(0.3);
  });

  it('nunca fica abaixo de zero', () => {
    expect(ajustarCarga(1, null, 2.5, -1)).toBe(0);
    expect(ajustarCarga(0, null, 0.5, -1)).toBe(0);
  });
});

describe('modos de carga do formato novo', () => {
  const igual = (uid: string) => serie(uid, 'Técnica', { intensidade: { modo: 'MESMA_CARGA' } });
  const acima = (uid: string) => serie(uid, 'Top set', { intensidade: { modo: 'ACIMA_DA_ANTERIOR', percentualMin: 5, percentualMax: 10 } });
  it('mesma carga usa a última WS registrada, e não a maior; sem registro usa a base', () => {
    const e = exercicio([ws('a'), ws('b'), igual('c')]);
    expect(calcularCargasDoExercicio(e, 30, { a: 50, b: 40 }, CONFIG)[2].sugestao).toBe(40);
    expect(calcularCargasDoExercicio(e, 30, {}, CONFIG)[2].sugestao).toBe(30);
    expect(calcularCargasDoExercicio(e, null, {}, CONFIG)[2].sugestao).toBeNull();
    expect(usaCargaDeTrabalho(exercicio([igual('c')]))).toBe(true);
  });
  it('acima da anterior usa só a carga registrada na série imediatamente anterior e o mínimo da faixa', () => {
    const e = exercicio([ws('a'), acima('b')]);
    expect(calcularCargasDoExercicio(e, 100, { a: 40 }, CONFIG)[1].sugestao).toBe(42);
    expect(calcularCargasDoExercicio(e, 100, {}, CONFIG)[1].sugestao).toBeNull();
    expect(calcularCargasDoExercicio(exercicio([acima('b')]), 100, {}, CONFIG)[0].sugestao).toBeNull();
  });
  it('percentual em faixa usa o mínimo, arredonda e não inventa carga sem referência', () => {
    const faixa = serie('c', 'FS', { intensidade: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: 90, rir: 0 } });
    expect(calcularCargasDoExercicio(exercicio([faixa]), 31, {}, CONFIG)[0].sugestao).toBe(26.5);
    expect(metaDaSerie(faixa, 'WS')).toBe('Meta: 3 reps · 85 a 90% da WS · até a falha');
    expect(calcularCargasDoExercicio(exercicio([faixa]), null, {}, CONFIG)[0].sugestao).toBeNull();
    expect(metaDaSerie(igual('c'), 'WS')).toContain('mesma carga da WS');
  });
});
