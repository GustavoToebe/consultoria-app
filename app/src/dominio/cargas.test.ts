import type { ExercicioPlano, Serie } from '../api/tipos';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { ajustarCarga, arredondar, calcularCargasDoExercicio, ehSerieDeTrabalho, metaDaSerie, passoDaCarga, usaCargaDeTrabalho } from './cargas';
import { carga, exercicio as exercicioDeTeste, rir, serie as serieDeTeste } from './exemplosDeTreino.apoioTeste';

const serie = (uid: string, tipo: string | null, extra: Partial<Serie>): Serie => serieDeTeste(uid, { tipo, repsMin: 3, repsMax: 3, carga: null, ...extra });
const fs = (uid: string, p: number) => serie(uid, 'FEEDER', { carga: carga('PERCENTUAL_WS', p) });
const ws = (uid: string) => serie(uid, 'WORKING', { repsMax: 6, carga: carga('CARGA_TRABALHO') });
const backOff = (uid: string, p: number) => serie(uid, 'BACK_OFF', { repsMin: 6, repsMax: 8, carga: carga('PERCENTUAL_WS', p) });
const backOffDe = (uid: string, referencia: string, p: number) => serie(uid, 'BACK_OFF', { repsMin: 6, repsMax: 8, carga: carga('ABAIXO_DA_REFERENCIA', p, null, referencia) });
const topSet = (uid: string, min: number, max: number | null) => serie(uid, 'TOP_SET', { repsMin: null, repsMax: null, carga: carga('ACIMA_DA_ANTERIOR', min, max) });

const exercicio = (series: Serie[], extra: Partial<ExercicioPlano> = {}): ExercicioPlano => exercicioDeTeste('e', { exercicioId: 'x', nome: 'Remada', modalidade: 'MAQUINA', series, ...extra });

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
    expect(arredondar(10.2, 0)).toBe(10.2);
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
    expect(metaDaSerie(serie('r', 'WORKING', { repsMin: 8, repsMax: 12, esforco: rir(1) }), 'WS')).toBe('Meta: 8 a 12 reps · 1 RIR');
    expect(metaDaSerie(serie('c', null, { repsMin: null, repsMax: null }), 'WS')).toBe('Meta: — reps');
    expect(metaDaSerie(topSet('t', 1, 5), 'WS')).toBe('Meta: — reps · +1 a 5% sobre a anterior');
  });

  it('AMRAP e alvo extra entram na meta', () => {
    const s = serie('a', 'WORKING', { repsMin: null, repsMax: null, amrap: true, carga: carga('CARGA_TRABALHO'), esforco: rir(0), alvoExtra: 'Sem pausa' });
    expect(metaDaSerie(s, 'WS')).toBe('Meta: AMRAP · carga de trabalho · até a falha técnica · Sem pausa');
  });

  it('série de trabalho é a de carga de trabalho, não a de tipo com o nome do rótulo', () => {
    expect(ehSerieDeTrabalho(ws('a'))).toBe(true);
    expect(ehSerieDeTrabalho(serie('b', 'WS', { carga: carga('MESMA_CARGA') }))).toBe(false);
    expect(ehSerieDeTrabalho(serie('c', 'WORKING', { carga: null }))).toBe(false);
  });
});

describe('Top set + 2 back off (abaixo da referência)', () => {
  const e = () => exercicio([ws('a'), topSet('t', 5, 10), backOffDe('b1', 't', 15), backOffDe('b2', 't', 15)]);

  it('cada back off sai da carga registrada na referência, não da série anterior', () => {
    const r = calcularCargasDoExercicio(e(), 100, { a: 40, t: 42, b1: 20 }, CONFIG);
    expect(r[1].sugestao).toBe(42); // top set: 40 + 5% (mínimo da faixa) = 42
    expect(r[2].sugestao).toBe(35.5); // 42 - 15% = 35,7 → passo de 0,5
    expect(r[3].sugestao).toBe(35.5); // o segundo também parte do top set, não do primeiro back off
  });

  it('acima da anterior arredonda para cima e abaixo da referência para baixo: nunca sugere a mesma carga', () => {
    const pouco = exercicio([ws('a'), topSet('t', 1, null), backOffDe('b', 't', 1)]);
    const r = calcularCargasDoExercicio(pouco, 20, { a: 20, t: 20.5 }, CONFIG);
    expect(r[1].sugestao).toBe(20.5); // 20 + 1% = 20,2: ao mais próximo daria 20, a mesma da anterior
    expect(r[2].sugestao).toBe(20); // 20,5 - 1% = 20,295: ao mais próximo daria 20,5, a mesma da referência
    expect(arredondar(42, 0.5, 'cima')).toBe(42); // múltiplo exato fica como está
    expect(arredondar(100.000000001, 2.5, 'cima')).toBe(100); // resto de ponto flutuante não sobe um passo
  });

  it('sem registro da referência não há sugestão; referência que vem depois ou não existe também não', () => {
    expect(calcularCargasDoExercicio(e(), 100, { a: 40 }, CONFIG)[2].sugestao).toBeNull();
    const depois = exercicio([backOffDe('b1', 'b2', 15), backOffDe('b2', 'b1', 15)]);
    expect(calcularCargasDoExercicio(depois, 100, { b1: 30, b2: 30 }, CONFIG).map((x) => x.sugestao)).toEqual([null, 25.5]);
    const perdida = exercicio([ws('a'), backOffDe('b', 'sumiu', 15)]);
    expect(calcularCargasDoExercicio(perdida, 100, { a: 40 }, CONFIG)[1].sugestao).toBeNull();
  });

  it('a meta do back off diz o tipo da referência pela metodologia', () => {
    const r = calcularCargasDoExercicio(e(), 100, {}, { ...CONFIG, metodologia: CONFIGURACAO_PADRAO });
    expect(r[2].meta).toBe('Meta: 6 a 8 reps · 15% abaixo da referência (Top set)');
  });
});

describe('cardio', () => {
  it('não sugere carga e a meta é a prescrição de cardio', () => {
    const c = serie('c', null, { repsMin: null, repsMax: null, cardio: { duracaoMin: 20, zona: 2 } });
    const [r] = calcularCargasDoExercicio(exercicio([c], { modalidade: 'CARDIO', unidade: 'nenhuma' }), 30, {}, CONFIG);
    expect(r.sugestao).toBeNull();
    expect(r.meta).toBe('Meta: 20 min · zona 2');
    expect(usaCargaDeTrabalho(exercicio([c], { modalidade: 'CARDIO' }))).toBe(false);
  });
});

describe('drop-set', () => {
  it('a sugestão é a carga de começo da série; a redução fica só no texto, sem calcular a carga das quedas', () => {
    const drop = serie('d', 'WORKING', {
      repsMax: 6,
      carga: carga('CARGA_TRABALHO'),
      tecnica: { tipo: 'DROP_SET', quedas: 2, reducaoPercentual: 20 },
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
  const igual = (uid: string) => serie(uid, null, { carga: carga('MESMA_CARGA') });
  const acima = (uid: string) => topSet(uid, 5, 10);
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
    const faixa = serie('c', 'FEEDER', { carga: carga('PERCENTUAL_WS', 85, 90), esforco: rir(0) });
    expect(calcularCargasDoExercicio(exercicio([faixa]), 31, {}, CONFIG)[0].sugestao).toBe(26.5);
    expect(metaDaSerie(faixa, 'WS')).toBe('Meta: 3 reps · 85 a 90% da WS · até a falha técnica');
    expect(calcularCargasDoExercicio(exercicio([faixa]), null, {}, CONFIG)[0].sugestao).toBeNull();
    expect(metaDaSerie(igual('c'), 'WS')).toContain('mesma carga da WS');
  });
  it('carga de trabalho e sem carga (nula ou NENHUMA) não calculam percentual', () => {
    const semCarga = serie('n', 'WARM_UP', { carga: null });
    const nenhuma = serie('m', 'WARM_UP', { carga: carga('NENHUMA') });
    expect(calcularCargasDoExercicio(exercicio([semCarga, nenhuma]), 30, {}, CONFIG).map((x) => x.sugestao)).toEqual([null, null]);
  });
});
