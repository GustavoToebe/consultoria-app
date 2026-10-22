// Prescrições e modelos fictícios: nenhum acesso à API nem a dados de aluno.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lerSeries, montarSeries, obsLimpa } from './importar.mjs';
import METODOLOGIA from './metodologia-padrao.json' with { type: 'json' };
const REGRA = METODOLOGIA.tipos.find((t) => t.papel === 'PREPARACAO').regraPercentuais;

test('aquecimento mantém a faixa e não prescreve carga', () => {
  assert.deepEqual(montarSeries(['1x10 a 15 - Aquecimento'], '', REGRA)[0].intensidade, { modo: 'NENHUMA' });
});
test('FS por quantidade usa faixas, em vez de percentuais soltos', () => {
  const tres = montarSeries(['3x3 - FS'], '', REGRA);
  assert.deepEqual(tres.map((s) => [s.intensidade.percentualMin, s.intensidade.percentualMax]), [[50,null],[70,null],[85,90]]);
  const duas = montarSeries(['2x3 a 5 - FS'], '', REGRA);
  assert.deepEqual(duas.map((s) => [s.repsMin,s.repsMax,s.intensidade.percentualMin,s.intensidade.percentualMax]), [[3,5,70,null],[3,5,85,90]]);
});
for (const [modalidade, rir] of [['LIVRE',1], ['MAQUINA',0]]) test(`WS por modalidade: ${modalidade}`, () => {
  assert.equal(montarSeries(['1x3 a 6 - WS'], '', REGRA, modalidade)[0].intensidade.rir, rir);
});
test('back off lê percentual explícito da WS', () => {
  const series = montarSeries(['2x6 a 8 - Back off (85% da WS)'], '', REGRA);
  assert.deepEqual(series.map((s) => s.intensidade.percentualMin), [85,85]);
});
test('rest pause depois de WS é só técnica com mesma carga e 1 pausa de 20 s', () => {
  const series = montarSeries(['2x8 - WS / 1x8 - Rest Pause'], '', REGRA);
  assert.equal(series.length, 3);
  assert.equal(series[2].tipo, null);
  assert.equal(series[2].intensidade.modo, 'MESMA_CARGA');
  assert.equal(series[2].tecnica.pausas, 1);
  assert.equal(series[2].tecnica.pausaSegundos, 20);
  assert.ok(!Object.hasOwn(series[2], 'alvoTexto'));
});
test('sem WS antes a técnica não inventa carga', () => {
  const [s] = montarSeries(['1x8-12 Rest pause'], '', REGRA);
  assert.equal(s.intensidade.modo, 'NENHUMA');
  assert.equal(s.tecnica.tipo, 'REST_PAUSE');
  assert.deepEqual([s.repsMin,s.repsMax], [8,12]);
});
test('WS + rest pause com 3 micro-séries tem duas pausas', () => {
  const [s] = montarSeries(['1x4 a 6 - WS + Rest-pause (3 micro-séries), 15 s'], '', REGRA);
  assert.equal(s.tipo, 'WS');
  assert.equal(s.tecnica.pausas, 2);
  assert.equal(s.tecnica.pausaSegundos, 15);
});
test('cluster desigual soma os blocos e usa a carga da WS', () => {
  const [,s] = montarSeries(['1x6 - WS', '1x6 (4+2) - Cluster Set, 15 s'], '', REGRA);
  assert.deepEqual(s.tecnica.blocos, [4,2]);
  assert.deepEqual([s.repsMin,s.repsMax], [6,6]);
  assert.equal(s.intensidade.modo, 'MESMA_CARGA');
});
test('Muscle Round conserva as duas alternativas de pausa', () => {
  const [s] = montarSeries(['Muscle Round 4 blocos de 4, pausa 5 respirações ou 10 s'], '', REGRA);
  assert.deepEqual(s.tecnica.blocos, [4,4,4,4]);
  assert.deepEqual([s.repsMin,s.repsMax], [16,16]);
  assert.equal(s.tecnica.pausaRespiracoes, 5);
  assert.equal(s.tecnica.pausaSegundos, 10);
});
test('top set é relativo à anterior; percentual explícito vence o padrão e ausência fica em branco', () => {
  assert.equal(montarSeries(['1x6 - Top set'], 'Top set +5%', REGRA)[0].intensidade.percentualMin, 5);
  assert.equal(montarSeries(['Top set'], '', REGRA)[0].intensidade.percentualMin, null);
  assert.deepEqual(montarSeries(['Top set'], '', REGRA, 'MAQUINA')[0].intensidade, METODOLOGIA.tipos.find((t) => t.nome === 'Top set').intensidadePorModalidade.MAQUINA);
});
test('não inventa tipo para série desconhecida; tipo em linha separada continua sendo uma prescrição', () => {
  assert.throws(() => lerSeries(['1x6 Desconhecido']), /Série sem tipo/);
  assert.equal(lerSeries(['3x3', 'FS'])[0].tipo, 'FS');
});
test('observação limpa só as descrições já representadas nas séries', () => {
  assert.equal(obsLimpa('WS + Rest-pause (3 micro-séries), 15 s'), null);
  assert.equal(obsLimpa('Mantenha o controle.'), 'Mantenha o controle.');
});
test('todos os modelos estáticos geram séries somente com o contrato atual', () => {
  const dados = JSON.parse(readFileSync(new URL('./dados/modelos.json', import.meta.url), 'utf8'));
  const modelos = Array.isArray(dados) ? dados : dados.modelos;
  for (const m of modelos) for (const sessao of m.sessoes) for (const e of sessao.exercicios) {
    const series = montarSeries(e.series.map((s) => typeof s === 'string' ? s : { n:s.count,tipo:s.tipo,min:null,max:null }), e.obs, REGRA);
    assert.ok(series.every((s) => !Object.hasOwn(s,'alvoTexto') && s.intensidade.modo !== 'LIVRE'));
  }
});

test('o padrão do importador é igual ao padrão do app', async () => {
  const { CONFIGURACAO_PADRAO } = await import('../../app/src/dominio/metodologiaPadrao.ts');
  assert.deepEqual(METODOLOGIA, CONFIGURACAO_PADRAO);
});
