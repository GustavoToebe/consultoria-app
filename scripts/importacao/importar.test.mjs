// Regras de séries do importador do Saraiva, só com dados fictícios: node --test scripts/importacao/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lerSeries, montarSeries } from './importar.mjs';

const REGRA = { 1: [85], 2: [70, 85], 3: [50, 70, 85] };

test('lerSeries lê "1x8-12 Rest pause" como um item do tipo Rest pause, com a faixa de repetições', () => {
  const itens = lerSeries(['1x8-12 Rest pause']);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].tipo, 'Rest pause');
  assert.equal(itens[0].min, 8);
  assert.equal(itens[0].max, 12);
});

test('montarSeries converte "Rest pause" em WS com alvo "Rest pause", sem técnica', () => {
  const series = montarSeries(['1x8-12 Rest pause'], '', REGRA);
  assert.equal(series.length, 1);
  assert.equal(series[0].tipo, 'WS');
  assert.equal(series[0].alvoTexto, 'Rest pause');
  assert.equal(series[0].intensidade.modo, 'CARGA_TRABALHO');
  assert.equal(series[0].tecnica, undefined);
  assert.equal(series[0].repsMin, 8);
  assert.equal(series[0].repsMax, 12);
});

test('tipo desconhecido ("1x6 Cluster") lança "Série sem tipo" em lerSeries', () => {
  assert.throws(() => lerSeries(['1x6 Cluster']), /Série sem tipo: "1x6 Cluster"/);
});

test('montarSeries aplica a regra de preparação pelo total de FS e separa FS, WS e Back off', () => {
  const series = montarSeries(['3x3 FS', '1x3-6 WS', '2x6-8 Back off'], '', REGRA);
  assert.equal(series.length, 6);

  const fs = series.slice(0, 3);
  assert.deepEqual(fs.map((s) => s.intensidade.modo), ['PERCENTUAL_WS', 'PERCENTUAL_WS', 'PERCENTUAL_WS']);
  assert.deepEqual(fs.map((s) => s.intensidade.percentual), [50, 70, 85]);

  assert.equal(series[3].tipo, 'WS');
  assert.equal(series[3].intensidade.modo, 'CARGA_TRABALHO');

  const backOff = series.slice(4);
  assert.deepEqual(backOff.map((s) => s.tipo), ['Back off', 'Back off']);

  assert.equal(series.some((s) => s.alvoTexto === 'Rest pause'), false);
});
