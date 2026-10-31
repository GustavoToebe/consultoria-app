import type { Tecnica } from '../api/tipos';
import { carga, rir, rpe, serie } from './exemplosDeTreino.apoioTeste';
import { tecnicaVazia } from './editorTreino';
import { esforcoVazio, problemasDaCarga, problemasDaSerie, problemasDaTecnica, problemasDoCardio, problemasDoEsforco } from './validacaoDeSerie';

const tecnica = (tipo: Tecnica['tipo'], extra: Partial<Tecnica> = {}): Tecnica => ({ ...tecnicaVazia(tipo), ...extra });

describe('carga', () => {
  it('sem carga ou carga de trabalho não tem problema; forma desconhecida é recusada', () => {
    expect(problemasDaCarga(null)).toEqual({});
    expect(problemasDaCarga(carga('CARGA_TRABALHO'))).toEqual({});
    expect(problemasDaCarga(carga('MESMA_CARGA'))).toEqual({});
    expect(problemasDaCarga({ ...carga('NENHUMA'), modo: 'OUTRA' as never })).toEqual({ modo: 'Forma de carga inválida.' });
  });

  it('% da WS: 1 a 200; o mínimo vence o máximo na mensagem', () => {
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 85, 90))).toEqual({});
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 200))).toEqual({});
    expect(problemasDaCarga(carga('PERCENTUAL_WS'))).toEqual({ percentualMin: 'Percentual da WS entre 1 e 200.' });
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 0))).toEqual({ percentualMin: 'Percentual da WS entre 1 e 200.' });
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 201))).toEqual({ percentualMin: 'Percentual da WS entre 1 e 200.' });
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 90, 85))).toEqual({ percentualMax: 'Percentual máximo entre o mínimo e 200.' });
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 90, 250))).toEqual({ percentualMax: 'Percentual máximo entre o mínimo e 200.' });
    expect(problemasDaCarga(carga('PERCENTUAL_WS', 0, 250))).toEqual({ percentualMin: 'Percentual da WS entre 1 e 200.' });
  });

  it('acima da anterior vai até 100; abaixo da referência até 50 e exige a referência', () => {
    expect(problemasDaCarga(carga('ACIMA_DA_ANTERIOR', 1, 5))).toEqual({});
    expect(problemasDaCarga(carga('ACIMA_DA_ANTERIOR', 101))).toEqual({ percentualMin: 'Acima da anterior: percentual entre 1 e 100.' });
    expect(problemasDaCarga(carga('ABAIXO_DA_REFERENCIA', 15, null, 't'))).toEqual({});
    expect(problemasDaCarga(carga('ABAIXO_DA_REFERENCIA', 51, null, 't'))).toEqual({ percentualMin: 'Abaixo da referência: redução entre 1 e 50.' });
    expect(problemasDaCarga(carga('ABAIXO_DA_REFERENCIA', 15))).toEqual({ referenciaUid: 'Escolha a série de referência.' });
    // Padrão do tipo na metodologia: a referência só nasce na série.
    expect(problemasDaCarga(carga('ABAIXO_DA_REFERENCIA', 15), false)).toEqual({});
  });
});

describe('esforço', () => {
  it('RIR de 0 a 5, RPE de 1 a 10 de meio em meio, nunca os dois', () => {
    expect(problemasDoEsforco(null)).toEqual({});
    expect(problemasDoEsforco(rir(0))).toEqual({});
    expect(problemasDoEsforco(rpe(8.5))).toEqual({});
    expect(problemasDoEsforco(rir(6))).toEqual({ rir: 'RIR entre 0 (até a falha) e 5.' });
    expect(problemasDoEsforco(rir(1.5))).toEqual({ rir: 'RIR entre 0 (até a falha) e 5.' });
    expect(problemasDoEsforco(rpe(0.5))).toEqual({ rpe: 'RPE precisa ficar entre 1 e 10, de meio em meio.' });
    expect(problemasDoEsforco(rpe(8.3))).toEqual({ rpe: 'RPE precisa ficar entre 1 e 10, de meio em meio.' });
    expect(problemasDoEsforco({ rir: 1, rpe: 8 })).toEqual({ rpe: 'Use RIR ou RPE, não os dois.' });
  });

  it('esforço sem RIR nem RPE é o mesmo que não ter', () => {
    expect(esforcoVazio(null)).toBe(true);
    expect(esforcoVazio({ rir: null, rpe: null })).toBe(true);
    expect(esforcoVazio(rir(0))).toBe(false);
  });
});

describe('cardio', () => {
  it('pede ao menos duração, distância ou intervalos e confere os limites', () => {
    expect(problemasDoCardio(null)).toEqual({});
    expect(problemasDoCardio({ duracaoMin: 30 })).toEqual({});
    expect(problemasDoCardio({})).toEqual({ duracaoMin: 'Informe a duração, a distância ou os intervalos.' });
    expect(problemasDoCardio({ duracaoMin: 601 })).toEqual({ duracaoMin: 'Duração de 1 a 600 minutos.' });
    expect(problemasDoCardio({ distanciaKm: 0 })).toEqual({ distanciaKm: 'Distância maior que zero e até 1000 km.' });
    expect(problemasDoCardio({ duracaoMin: 10, zona: 6 })).toEqual({ zona: 'Zona de 1 a 5.' });
    expect(problemasDoCardio({ duracaoMin: 10, ritmo: 'x'.repeat(41) })).toEqual({ ritmo: 'Ritmo com no máximo 40 caracteres.' });
  });

  it('intervalos têm os próprios limites, por campo', () => {
    expect(problemasDoCardio({ intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } })).toEqual({});
    expect(problemasDoCardio({ intervalos: { trabalhoSeg: 0, descansoSeg: 3601, voltas: 101 } })).toEqual({
      'intervalos.trabalhoSeg': 'Tempo de esforço de 1 a 3600 segundos.',
      'intervalos.descansoSeg': 'Descanso de 0 a 3600 segundos.',
      'intervalos.voltas': 'Voltas de 1 a 100.',
    });
  });
});

describe('técnica', () => {
  it('rest pause: pausa em segundos ou respirações, de 1 a 5 pausas', () => {
    expect(problemasDaTecnica(tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 1 }))).toEqual({});
    expect(problemasDaTecnica(tecnica('REST_PAUSE', { pausaRespiracoes: 5 }))).toEqual({});
    expect(problemasDaTecnica(tecnica('REST_PAUSE'))).toEqual({ pausaSegundos: 'Informe a pausa em segundos ou em respirações.' });
    expect(problemasDaTecnica(tecnica('REST_PAUSE'), false)).toEqual({});
    expect(problemasDaTecnica(tecnica('REST_PAUSE', { pausaSegundos: 3 }))).toEqual({ pausaSegundos: 'Pausa de 5 a 600 segundos.' });
    expect(problemasDaTecnica(tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 6 }))).toEqual({ pausas: 'Pausas do rest pause entre 1 e 5.' });
  });

  it('cluster: de 2 a 10 blocos de 1 a 50', () => {
    const base = { pausaSegundos: 15 };
    expect(problemasDaTecnica(tecnica('CLUSTER', { ...base, blocos: [4, 2] }))).toEqual({});
    for (const blocos of [null, [4], Array(11).fill(2), [4, 0], [4, 51]]) {
      expect(problemasDaTecnica(tecnica('CLUSTER', { ...base, blocos }))).toEqual({ blocos: 'Cluster: de 2 a 10 blocos, cada um com 1 a 50 repetições.' });
    }
    // Padrão parcial da metodologia: sem blocos é permitido.
    expect(problemasDaTecnica(tecnica('CLUSTER', base), false)).toEqual({});
  });

  it('drop-set: quedas de 1 a 5, redução 5 a 50, repetições por queda 1 a 50, descanso 0 a 600', () => {
    expect(problemasDaTecnica(tecnica('DROP_SET', { quedas: 2, reducaoPercentual: 20 }))).toEqual({});
    expect(problemasDaTecnica(tecnica('DROP_SET'))).toEqual({ quedas: 'Quedas do drop-set entre 1 e 5.' });
    expect(problemasDaTecnica(tecnica('DROP_SET', { quedas: 2, reducaoPercentual: 4, repsPorQueda: 51, pausaSegundos: 601 }))).toEqual({
      reducaoPercentual: 'Redução da carga entre 5% e 50% (ou vazio, sem fixar).',
      repsPorQueda: 'Repetições por queda entre 1 e 50 (ou vazio, até a falha).',
      pausaSegundos: 'Descanso entre as quedas de 0 a 600 segundos (0 = sem descanso).',
    });
    expect(problemasDaTecnica(tecnica('DROP_SET', { quedas: 2, pausaSegundos: 0 }))).toEqual({});
  });

  it('myo-reps, partial reps e forced reps', () => {
    expect(problemasDaTecnica(tecnica('MYO_REPS', { miniSeries: 4, repsPorMiniSerie: 3, pausaRespiracoes: 5 }))).toEqual({});
    expect(problemasDaTecnica(tecnica('MYO_REPS'))).toEqual({
      miniSeries: 'Myo-reps: de 2 a 10 mini-séries.',
      repsPorMiniSerie: 'Myo-reps: de 1 a 50 repetições por mini-série.',
      pausaSegundos: 'Informe a pausa em segundos ou em respirações.',
    });
    expect(problemasDaTecnica(tecnica('PARTIAL_REPS', { repsParciais: 5, regiao: 'ALONGADA' }))).toEqual({});
    expect(problemasDaTecnica(tecnica('PARTIAL_REPS', { repsParciais: 31, regiao: 'QUALQUER' as never }))).toEqual({
      repsParciais: 'Repetições parciais entre 1 e 30.',
      regiao: 'Região das parciais: alongada, encurtada ou livre.',
    });
    expect(problemasDaTecnica(tecnica('FORCED_REPS', { repsAssistidas: 2 }))).toEqual({});
    expect(problemasDaTecnica(tecnica('FORCED_REPS', { repsAssistidas: 6 }))).toEqual({ repsAssistidas: 'Repetições assistidas entre 1 e 5.' });
  });

  it('técnica desconhecida é recusada', () => {
    expect(Object.keys(problemasDaTecnica({ tipo: 'OUTRA' } as never))).toEqual(['tipo']);
  });
});

describe('série', () => {
  it('série de trabalho comum é válida', () => {
    expect(problemasDaSerie(serie('a', { repsMin: 3, repsMax: 6, esforco: rir(1) }), false)).toEqual({});
  });

  it('tipo é obrigatório fora do cardio; descanso e alvo extra têm limites', () => {
    expect(problemasDaSerie(serie('a', { tipo: null }), false)).toEqual({ tipo: 'Série sem tipo.' });
    expect(problemasDaSerie(serie('a', { tipo: '  ' }), false).tipo).toBe('Série sem tipo.');
    expect(problemasDaSerie(serie('a', { descansoSegundos: 3601 }), false)).toEqual({ descansoSegundos: 'Descanso precisa ficar entre 0 e 3600 segundos.' });
    expect(problemasDaSerie(serie('a', { alvoExtra: 'x'.repeat(121) }), false)).toEqual({ alvoExtra: 'Observação desta série com no máximo 120 caracteres.' });
  });

  it('repetições: juntas ou nenhuma, de 0 a 500, máximo não menor que o mínimo', () => {
    expect(problemasDaSerie(serie('a', { repsMin: null, repsMax: null }), false)).toEqual({});
    expect(problemasDaSerie(serie('a', { repsMin: 6, repsMax: null }), false)).toEqual({ repsMax: 'Informe repetições mínima e máxima, ou nenhuma (série por tempo).' });
    expect(problemasDaSerie(serie('a', { repsMin: 8, repsMax: 6 }), false)).toEqual({ repsMax: 'Repetição máxima menor que a mínima.' });
    expect(problemasDaSerie(serie('a', { repsMin: 1, repsMax: 501 }), false)).toEqual({ repsMin: 'Repetições precisam ficar entre 0 e 500.' });
  });

  it('AMRAP não leva repetições', () => {
    expect(problemasDaSerie(serie('a', { amrap: true, repsMin: null, repsMax: null }), false)).toEqual({});
    expect(problemasDaSerie(serie('a', { amrap: true, repsMin: 3, repsMax: 6 }), false)).toEqual({ amrap: 'AMRAP é o máximo de repetições: tire as repetições mínima e máxima.' });
  });

  it('os problemas da carga, do esforço e da técnica entram com o prefixo do campo', () => {
    const s = serie('a', {
      carga: carga('PERCENTUAL_WS', 0),
      esforco: { rir: 1, rpe: 8 },
      tecnica: tecnica('DROP_SET'),
    });
    expect(Object.keys(problemasDaSerie(s, false)).sort()).toEqual(['carga.percentualMin', 'esforco.rpe', 'tecnica.quedas']);
  });

  it('cluster: as repetições são a soma dos blocos', () => {
    const cluster = tecnica('CLUSTER', { blocos: [4, 2], pausaSegundos: 15 });
    expect(problemasDaSerie(serie('a', { repsMin: 6, repsMax: 6, tecnica: cluster }), false)).toEqual({});
    expect(problemasDaSerie(serie('a', { repsMin: 3, repsMax: 6, tecnica: cluster }), false)).toEqual({ repsMin: 'Cluster: as repetições são a soma dos blocos (6).' });
  });

  it('cardio só em exercício de cardio, e o exercício de cardio só leva cardio', () => {
    expect(problemasDaSerie(serie('a', { cardio: { duracaoMin: 10 } }), false)).toEqual({ cardio: 'A prescrição de cardio só vale em exercício de cardio.' });
    const limpa = serie('c', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20 } });
    expect(problemasDaSerie(limpa, true)).toEqual({});
    expect(problemasDaSerie({ ...limpa, cardio: null }, true)).toEqual({ cardio: 'Série de cardio sem prescrição (duração, distância ou intervalos).' });
    expect(problemasDaSerie({ ...limpa, cardio: { duracaoMin: 0 } }, true)).toEqual({ 'cardio.duracaoMin': 'Duração de 1 a 600 minutos.' });
    const suja = serie('c', { tipo: 'WORKING', amrap: true, esforco: rir(1), tecnica: tecnica('FORCED_REPS', { repsAssistidas: 1 }), cardio: { duracaoMin: 20 } });
    expect(Object.keys(problemasDaSerie(suja, true)).sort()).toEqual(['carga', 'esforco', 'repsMin', 'tecnica', 'tipo']);
    expect(problemasDaSerie({ ...limpa, carga: carga('NENHUMA') }, true)).toEqual({});
  });
});
