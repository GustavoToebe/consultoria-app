import type { ExercicioPlano, Serie } from '../api/tipos';
import { arredondar, calcularCargasDoExercicio, metaDaSerie } from './cargas';

const serie = (uid: string, tipo: string, extra: Partial<Serie>): Serie => ({
  uid,
  tipo,
  repsMin: 3,
  repsMax: 3,
  alvoTexto: null,
  intensidade: null,
  descansoSegundos: null,
  ...extra,
});
const fs = (uid: string, p: number) => serie(uid, 'FS', { intensidade: { modo: 'PERCENTUAL_WS', percentual: p } });
const ws = (uid: string) => serie(uid, 'WS', { repsMax: 6, intensidade: { modo: 'CARGA_TRABALHO' } });
const backOff = (uid: string, p: number) =>
  serie(uid, 'Back off', { repsMin: 6, repsMax: 8, intensidade: { modo: 'PERCENTUAL_WS', percentual: p } });

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
    expect(metaDaSerie(serie('r', 'Série', { repsMin: 8, repsMax: 12, intensidade: { modo: 'RIR', rir: 1 } }), 'WS')).toBe(
      'Meta: 8 a 12 reps · 1 RIR',
    );
    expect(metaDaSerie(serie('c', 'Cardio', { repsMin: null, repsMax: null, alvoTexto: '50 min' }), 'WS')).toBe('Meta: 50 min');
  });
});

