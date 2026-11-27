import type { ExercicioPlano, Serie, Sessao, UltimaCarga } from '../api/tipos';
import {
  cabecalhoDoExercicio, contaEmBlocos, indiceDaSerieAtiva, melhorWsDeHoje, metaDaLinhaDaSerie, metaDaWsDoExercicio, progressoDosExercicios,
  quantasSeries, recordeDaWs, textoDasSeriesFeitas, textoDoRecordeDaWs, textoDoUltimoRegistro, topoDoExercicio, type RegistroDaWs,
} from './telaDoExercicio';

const ws = (uid: string, repsMin: number | null = 6, repsMax: number | null = 8, extra: Partial<Serie> = {}): Serie =>
  ({ uid, tipo: 'WS', repsMin, repsMax, carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 0 }, descansoSegundos: 90, ...extra }) as Serie;
const fs = (uid: string): Serie => ({ uid, tipo: 'FS', repsMin: 10, repsMax: 12, carga: { modo: 'PERCENTUAL_WS' }, esforco: null, descansoSegundos: null }) as Serie;
const exercicio = (series: Serie[], extra: Partial<ExercicioPlano> = {}): ExercicioPlano => ({ uid: 'e1', nome: 'Agachamento', modalidade: 'LIVRE', unidade: 'kg', series, ...extra }) as ExercicioPlano;
const ultima = (carga: number | null, repeticoes: number | null, data = '2026-11-18'): UltimaCarga => ({ carga, repeticoes, data });
const feito = (carga: number | null, repeticoes: number | null): RegistroDaWs => ({ concluida: true, etapas: null, carga, repeticoes });

describe('último registro', () => {
  it('"Último registro: 90 kg × 7 em 18/11" e "Sem registro anterior"', () => {
    expect(textoDoUltimoRegistro(ultima(90, 7))).toBe('Último registro: 90 kg × 7 em 18/11');
    expect(textoDoUltimoRegistro(ultima(92.5, 5, '2026-01-02'))).toBe('Último registro: 92,5 kg × 5 em 02/01');
    expect(textoDoUltimoRegistro(null)).toBe('Sem registro anterior');
    expect(textoDoUltimoRegistro(ultima(null, 7))).toBe('Sem registro anterior');
  });
  it('sem repetições mostra só a carga, nunca inventa o número', () => {
    expect(textoDoUltimoRegistro(ultima(90, null))).toBe('Último registro: 90 kg em 18/11');
  });
  it('na unidade do aluno', () => {
    expect(textoDoUltimoRegistro(ultima(45.36, 7), 'lb')).toBe('Último registro: 100 lb × 7 em 18/11');
  });
});

describe('cabeçalho do exercício e meta', () => {
  it('"Peso livre · 3 séries · meta da WS: 6 a 8 reps"', () => {
    expect(cabecalhoDoExercicio(exercicio([ws('a'), ws('b'), ws('c')]), 'WS')).toBe('Peso livre · 3 séries · meta da WS: 6 a 8 reps');
  });
  it('some a parte que não existe: sem WS, sem modalidade, uma série', () => {
    expect(cabecalhoDoExercicio(exercicio([fs('a'), fs('b')]), 'WS')).toBe('Peso livre · 2 séries');
    expect(cabecalhoDoExercicio(exercicio([ws('a')], { modalidade: null }), 'WS')).toBe('1 série · meta da WS: 6 a 8 reps');
  });
  it('faixas diferentes entre as séries de trabalho não têm meta única; AMRAP e série por tempo', () => {
    expect(metaDaWsDoExercicio({ series: [ws('a'), ws('b', 8, 10)] }, 'WS')).toBeNull();
    expect(metaDaWsDoExercicio({ series: [ws('a', null, null, { amrap: true })] }, 'WS')).toBe('meta da WS: AMRAP');
    expect(metaDaWsDoExercicio({ series: [ws('a', null, null)] }, 'WS')).toBeNull();
  });
  it('meta da série: repetições e esforço, sem carga', () => {
    expect(metaDaLinhaDaSerie(ws('a'))).toBe('6 a 8 reps · até a falha');
    expect(metaDaLinhaDaSerie(ws('a', 10, 10, { esforco: { rir: 2 } }))).toBe('10 reps · 2 RIR');
    expect(metaDaLinhaDaSerie(ws('a', 8, 12, { esforco: null }))).toBe('8 a 12 reps');
    expect(metaDaLinhaDaSerie(ws('a', null, null, { amrap: true, esforco: null }))).toBe('AMRAP');
    expect(metaDaLinhaDaSerie(ws('a', null, null, { esforco: null }))).toBe('');
  });
});

describe('séries feitas e série ativa', () => {
  it('a ativa é a primeira não feita', () => {
    const series = [ws('a'), ws('b'), ws('c')];
    expect(indiceDaSerieAtiva(series, () => false)).toBe(0);
    expect(indiceDaSerieAtiva(series, (u) => u === 'a')).toBe(1);
    expect(indiceDaSerieAtiva(series, (u) => u !== 'b')).toBe(1);
    expect(indiceDaSerieAtiva(series, () => true)).toBe(-1);
  });
  it('"Séries 0 de 3 feitas"', () => {
    expect(textoDasSeriesFeitas({ feitas: 0, total: 3 })).toBe('Séries 0 de 3 feitas');
    expect(textoDasSeriesFeitas({ feitas: 1, total: 1 })).toBe('Série 1 de 1 feita');
  });
});

describe('cardio novo conta em blocos', () => {
  const bloco = (uid: string, cardio: Serie['cardio']): Serie =>
    ({ uid, tipo: null, repsMin: null, repsMax: null, carga: null, esforco: null, descansoSegundos: null, cardio }) as Serie;
  const continuoAntigo = { duracaoMin: 30, distanciaKm: null, ritmo: null, zona: 2, intervalos: null };
  const sit = { modo: 'INTERVALADO' as const, protocolo: 'SIT' as const, duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, esforcoMaximo: true,
    aquecimentoSeg: 240, desaquecimentoSeg: 180, intervalos: { trabalhoSeg: 30, descansoSeg: 180, voltas: 6 } };
  const novo = exercicio([bloco('c1', continuoAntigo), bloco('c2', sit)], { modalidade: 'CARDIO', unidade: 'nenhuma' });
  const antigo = exercicio([bloco('c1', continuoAntigo), bloco('c2', continuoAntigo)], { modalidade: 'CARDIO', unidade: 'nenhuma' });
  it('basta um bloco com modo; o cardio antigo (sem modo) continua em séries', () => {
    expect(contaEmBlocos(novo)).toBe(true);
    expect(contaEmBlocos(antigo)).toBe(false);
    expect(contaEmBlocos(exercicio([ws('a')]))).toBe(false);
  });
  it('"Cardio · 2 blocos" e "Blocos 0 de 2 feitos"; o antigo como antes', () => {
    expect(cabecalhoDoExercicio(novo, 'WS')).toBe('Cardio · 2 blocos');
    expect(cabecalhoDoExercicio(antigo, 'WS')).toBe('Cardio · 2 séries');
    expect(textoDasSeriesFeitas({ feitas: 0, total: 2 }, true)).toBe('Blocos 0 de 2 feitos');
    expect(textoDasSeriesFeitas({ feitas: 1, total: 1 }, true)).toBe('Bloco 1 de 1 feito');
    expect(quantasSeries(1, true)).toBe('1 bloco');
    expect(quantasSeries(3, false)).toBe('3 séries');
  });
});

describe('topo da sessão', () => {
  const sessao = { uid: 's', nome: 'Pernas', diaSemana: 3, exercicios: [exercicio([ws('a')]), exercicio([ws('b')], { uid: 'e2' })] } as unknown as Sessao;
  it('"Quarta - Pernas" e "Exercício 1 de 2"', () => {
    expect(topoDoExercicio(sessao, 0)).toEqual({ titulo: 'Quarta - Pernas', posicao: 'Exercício 1 de 2' });
  });
  it('uma barra por exercício', () => {
    expect(progressoDosExercicios(sessao, (u) => u === 'a')).toEqual([
      { uid: 'e1', feitas: 1, total: 1, completo: true },
      { uid: 'e2', feitas: 0, total: 1, completo: false },
    ]);
  });
});

describe('recorde da WS (bater a WS anterior)', () => {
  const e = exercicio([ws('a'), ws('b'), ws('c'), fs('d')]);
  it('a melhor WS de hoje: maior carga, empate com mais repetições; só feita e simples', () => {
    const registros: Record<string, RegistroDaWs> = { a: feito(90, 7), b: feito(92.5, 5), c: feito(92.5, 6), d: feito(200, 20) };
    expect(melhorWsDeHoje(e, (u) => registros[u])).toEqual({ carga: 92.5, repeticoes: 6 });
    expect(melhorWsDeHoje(e, (u) => (u === 'a' ? { ...feito(90, 7), concluida: false } : undefined))).toBeNull();
    expect(melhorWsDeHoje(e, (u) => (u === 'a' ? feito(90, null) : undefined))).toBeNull();
    expect(melhorWsDeHoje(e, (u) => (u === 'a' ? { ...feito(90, 7), etapas: [{}] } : undefined))).toBeNull();
  });
  it('carga maior ou mesma carga com mais repetições bate; igual ou menor, não', () => {
    expect(recordeDaWs({ carga: 92.5, repeticoes: 5 }, ultima(90, 7))?.tipo).toBe('MAIS_CARGA');
    expect(recordeDaWs({ carga: 90, repeticoes: 8 }, ultima(90, 7))?.tipo).toBe('MAIS_REPETICOES');
    expect(recordeDaWs({ carga: 90, repeticoes: 7 }, ultima(90, 7))).toBeNull();
    expect(recordeDaWs({ carga: 87.5, repeticoes: 12 }, ultima(90, 7))).toBeNull();
  });
  it('sem WS anterior (ou sem carga ou sem repetições nela) não há contra o que bater', () => {
    expect(recordeDaWs({ carga: 90, repeticoes: 7 }, null)).toBeNull();
    expect(recordeDaWs({ carga: 90, repeticoes: 7 }, ultima(null, 7))).toBeNull();
    expect(recordeDaWs({ carga: 90, repeticoes: 9 }, ultima(90, null))).toBeNull();
    expect(recordeDaWs(null, ultima(90, 7))).toBeNull();
  });
  it('texto do aviso', () => {
    const r = recordeDaWs({ carga: 92.5, repeticoes: 7 }, ultima(90, 7))!;
    expect(textoDoRecordeDaWs(r, 'WS')).toEqual({ titulo: 'Recorde na WS', detalhe: '92,5 kg × 7 (antes: 90 kg × 7 em 18/11)' });
  });
});
