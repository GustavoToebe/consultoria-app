// Prescrições e modelos fictícios: nenhum acesso à API nem a dados de aluno.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { cargaDe, codigoDoTipo, lerSeries, montarGrupos, montarSeries, problemasDosGrupos, obsLimpa, reducaoDoBackOff, serieDeCardio } from './importar.mjs';
import { CODIGOS, TECNICAS_DE_GRUPO, verificarContratoDoTreino, verificarSerie } from './contrato-apoio-teste.mjs';
import METODOLOGIA from './metodologia-padrao.json' with { type: 'json' };
const REGRA = METODOLOGIA.tipos.find((t) => t.papel === 'PREPARACAO').regraPercentuais;
const tipoPadrao = (nome) => METODOLOGIA.tipos.find((t) => t.nome === nome);
const cargas = (series) => series.map((s) => [s.carga.modo, s.carga.percentualMin, s.carga.percentualMax]);

/** Confere as séries como a API confere: tipo por código, carga completa, referência de série anterior do mesmo exercício. */
function conferir(series, deCardio = false) {
  const anteriores = new Set();
  series.forEach((s, k) => anteriores.add(verificarSerie(s, deCardio, anteriores, `série ${k}`)));
}

test('os tipos da série são os códigos da metodologia', () => {
  assert.deepEqual(['Aquecimento', 'FS', 'WS', 'Top set', 'Back off'].map(codigoDoTipo), ['WARM_UP', 'FEEDER', 'WORKING', 'TOP_SET', 'BACK_OFF']);
  assert.deepEqual(CODIGOS, ['WARM_UP', 'FEEDER', 'WORKING', 'TOP_SET', 'BACK_OFF']);
  assert.throws(() => codigoDoTipo('Inventado'), /fora da metodologia padrão/);
});
test('aquecimento mantém a faixa e não prescreve carga nem esforço', () => {
  const [s] = montarSeries(['1x10 a 15 - Aquecimento'], '', REGRA);
  assert.equal(s.tipo, 'WARM_UP');
  assert.deepEqual(s.carga, cargaDe('NENHUMA'));
  assert.equal(s.esforco, null);
  assert.deepEqual([s.repsMin, s.repsMax], [10, 15]);
});
test('FS por quantidade usa faixas, em vez de percentuais soltos', () => {
  const tres = montarSeries(['3x3 - FS'], '', REGRA);
  assert.deepEqual(tres.map((s) => s.tipo), ['FEEDER', 'FEEDER', 'FEEDER']);
  assert.deepEqual(cargas(tres), [['PERCENTUAL_WS', 50, null], ['PERCENTUAL_WS', 70, null], ['PERCENTUAL_WS', 85, 90]]);
  const duas = montarSeries(['2x3 a 5 - FS'], '', REGRA);
  assert.deepEqual(duas.map((s) => [s.repsMin, s.repsMax, s.carga.percentualMin, s.carga.percentualMax]), [[3, 5, 70, null], [3, 5, 85, 90]]);
  conferir(tres);
});
test('FS sem regra para a quantidade fica sem carga, sem inventar percentual', () => {
  const series = montarSeries(['4x3 - FS'], '', REGRA);
  assert.deepEqual(cargas(series), Array(4).fill(['NENHUMA', null, null]));
});
for (const [modalidade, rir] of [['LIVRE', 1], ['MAQUINA', 0]]) test(`WS por modalidade: ${modalidade}`, () => {
  const [s] = montarSeries(['1x3 a 6 - WS'], '', REGRA, modalidade);
  assert.equal(s.tipo, 'WORKING');
  assert.equal(s.carga.modo, 'CARGA_TRABALHO');
  assert.deepEqual(s.esforco, { rir, rpe: null });
});
test('WS sem modalidade não inventa esforço', () => {
  assert.equal(montarSeries(['1x3 a 6 - WS'], '', REGRA)[0].esforco, null);
});
test('back off lê o percentual explícito da WS como PERCENTUAL_WS', () => {
  const series = montarSeries(['1x6 - WS', '2x6 a 8 - Back off (85% da WS)'], '', REGRA);
  assert.deepEqual(cargas(series.slice(1)), [['PERCENTUAL_WS', 85, null], ['PERCENTUAL_WS', 85, null]]);
  assert.ok(series.slice(1).every((s) => s.tipo === 'BACK_OFF' && s.carga.referenciaUid === null));
  conferir(series);
});
test('back off sem número não inventa percentual', () => {
  assert.deepEqual(montarSeries(['1x6 - Back off'], '', REGRA)[0].carga, cargaDe('NENHUMA'));
});
test('reducaoDoBackOff separa redução de percentual da WS e acha de onde ela parte', () => {
  assert.deepEqual(reducaoDoBackOff('Back off: reduzir 10% da Top set'), { percentual: 10, referencia: 'TOP' });
  assert.deepEqual(reducaoDoBackOff('Back off reduzindo 15% da série anterior.'), { percentual: 15, referencia: 'ANTERIOR' });
  assert.deepEqual(reducaoDoBackOff('Back off com 10% a menos'), { percentual: 10, referencia: null });
  assert.equal(reducaoDoBackOff('Back off com 85% da carga da WS'), null);
});
test('back off com redução da Top set aponta para a Top set do mesmo exercício', () => {
  const series = montarSeries(['1x6 - WS', '1x4 - Top set', '1x8 - Back off'], 'Back off: reduzir 10% da Top set', REGRA, 'LIVRE');
  const [ws, top, bo] = series;
  assert.deepEqual(bo.carga, { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: null, referenciaUid: top.uid });
  assert.notEqual(bo.carga.referenciaUid, ws.uid);
  conferir(series);
});
test('back off com redução da série anterior aponta para a série imediatamente anterior', () => {
  const series = montarSeries(['2x6 - WS', '1x8 - Back off'], 'Back off: reduzir 20% da série anterior', REGRA);
  assert.equal(series[2].carga.modo, 'ABAIXO_DA_REFERENCIA');
  assert.equal(series[2].carga.referenciaUid, series[1].uid);
  conferir(series);
});
test('back off com redução sem referência clara fica sem carga, em vez de supor uma série', () => {
  const [, bo] = montarSeries(['1x6 - WS', '1x8 - Back off'], 'Back off com 10% a menos', REGRA);
  assert.deepEqual(bo.carga, cargaDe('NENHUMA'));
  const [, sem] = montarSeries(['1x6 - WS', '1x8 - Back off'], 'Back off: reduzir 10% da Top set', REGRA);
  assert.deepEqual(sem.carga, cargaDe('NENHUMA'), 'não há Top set no exercício para ser a referência');
});
test('redução fora de 1 a 50 não vira ABAIXO_DA_REFERENCIA', () => {
  const [, bo] = montarSeries(['1x6 - WS', '1x8 - Back off'], 'Back off: reduzir 60% da série anterior', REGRA);
  assert.equal(bo.carga.modo, 'NENHUMA');
});
test('rest pause depois de WS é só técnica dentro da WS: mesmo tipo, mesma carga de trabalho, 1 pausa de 20 s', () => {
  const series = montarSeries(['2x8 - WS / 1x8 - Rest Pause'], '', REGRA);
  assert.equal(series.length, 3);
  assert.equal(series[2].tipo, 'WORKING');
  assert.equal(series[2].carga.modo, 'CARGA_TRABALHO');
  assert.equal(series[2].tecnica.tipo, 'REST_PAUSE');
  assert.equal(series[2].tecnica.pausas, 1);
  assert.equal(series[2].tecnica.pausaSegundos, 20);
  assert.ok(!Object.hasOwn(series[2], 'alvoTexto'));
  conferir(series);
});
test('sem tipo escrito a técnica entra numa WS, sem inventar número', () => {
  const [s] = montarSeries(['1x8-12 Rest pause'], '', REGRA);
  assert.equal(s.tipo, 'WORKING');
  assert.equal(s.carga.modo, 'CARGA_TRABALHO');
  assert.equal(s.tecnica.tipo, 'REST_PAUSE');
  assert.deepEqual([s.repsMin, s.repsMax], [8, 12]);
});
test('WS + rest pause com 3 micro-séries tem duas pausas', () => {
  const [s] = montarSeries(['1x4 a 6 - WS + Rest-pause (3 micro-séries), 15 s'], '', REGRA);
  assert.equal(s.tipo, 'WORKING');
  assert.equal(s.tecnica.pausas, 2);
  assert.equal(s.tecnica.pausaSegundos, 15);
});
test('cluster desigual soma os blocos e fica dentro da WS', () => {
  const series = montarSeries(['1x6 - WS', '1x6 (4+2) - Cluster Set, 15 s'], '', REGRA);
  const s = series[1];
  assert.deepEqual(s.tecnica.blocos, [4, 2]);
  assert.deepEqual([s.repsMin, s.repsMax], [6, 6]);
  assert.deepEqual([s.tipo, s.carga.modo], ['WORKING', 'CARGA_TRABALHO']);
  conferir(series);
});
test('Muscle Round conserva as duas alternativas de pausa', () => {
  const [s] = montarSeries(['Muscle Round 4 blocos de 4, pausa 5 respirações ou 10 s'], '', REGRA);
  assert.deepEqual(s.tecnica.blocos, [4, 4, 4, 4]);
  assert.deepEqual([s.repsMin, s.repsMax], [16, 16]);
  assert.equal(s.tecnica.pausaRespiracoes, 5);
  assert.equal(s.tecnica.pausaSegundos, 10);
  conferir([s]);
});
test('drop-set fica na série de trabalho, com a queda do padrão ou a escrita', () => {
  const [a] = montarSeries(['1x8 - WS - Drop-set'], '', REGRA);
  assert.equal(a.tecnica.tipo, 'DROP_SET');
  assert.equal(a.tecnica.quedas, 1);
  assert.deepEqual([a.tipo, a.carga.modo], ['WORKING', 'CARGA_TRABALHO']);
  const [b] = montarSeries(['1x8 - WS - Drop-set (2 quedas)'], '', REGRA);
  assert.equal(b.tecnica.quedas, 2);
  conferir([a, b]);
});
test('top set é ACIMA_DA_ANTERIOR; percentual explícito vence o padrão e ausência fica em branco', () => {
  const [explicito] = montarSeries(['1x6 - Top set'], 'Top set +5%', REGRA);
  assert.deepEqual(explicito.carga, cargaDe('ACIMA_DA_ANTERIOR', { percentualMin: 5 }));
  assert.equal(montarSeries(['Top set'], '', REGRA)[0].carga.percentualMin, null);
  assert.equal(montarSeries(['Top set'], '', REGRA)[0].carga.modo, 'ACIMA_DA_ANTERIOR');
  assert.equal(montarSeries(['Top set'], '', REGRA)[0].tipo, 'TOP_SET');
});
for (const modalidade of ['LIVRE', 'MAQUINA']) test(`top set usa a carga do padrão da modalidade: ${modalidade}`, () => {
  const [s] = montarSeries(['Top set'], '', REGRA, modalidade);
  assert.deepEqual(s.carga, tipoPadrao('Top set').porModalidade[modalidade].carga);
  assert.equal(s.esforco, null);
});
test('o JSON do padrão não é alterado ao montar as séries', () => {
  const antes = structuredClone(METODOLOGIA);
  const [s] = montarSeries(['Top set'], '', REGRA, 'MAQUINA');
  s.carga.percentualMin = 99;
  montarSeries(['1x6 - WS'], '', REGRA, 'LIVRE')[0].esforco.rir = 4;
  assert.deepEqual(METODOLOGIA, antes);
});
test('RIR e RPE nunca saem juntos e o tipo nunca é nulo fora do cardio', () => {
  const linhas = ['1x10 - Aquecimento', '3x3 - FS', '2x4 a 6 - WS', '1x4 - Top set', '1x8 - Back off (85% da WS)', '1x8 - WS / 1x8 - Rest Pause'];
  for (const modalidade of [null, 'LIVRE', 'MAQUINA']) for (const s of montarSeries(linhas, '', REGRA, modalidade)) {
    assert.ok(CODIGOS.includes(s.tipo));
    assert.ok(s.esforco === null || s.esforco.rir == null || s.esforco.rpe == null);
  }
});
test('não inventa tipo para série desconhecida; tipo em linha separada continua sendo uma prescrição', () => {
  assert.throws(() => lerSeries(['1x6 Desconhecido']), /Série sem tipo/);
  assert.equal(lerSeries(['3x3', 'FS'])[0].tipo, 'FS');
});
test('observação limpa só as descrições já representadas nas séries', () => {
  assert.equal(obsLimpa('WS + Rest-pause (3 micro-séries), 15 s'), null);
  assert.equal(obsLimpa('Mantenha o controle.'), 'Mantenha o controle.');
});

// ------------------------------------------------------------------------------------------------------- cardio
test('série de cardio só tem cardio: sem tipo, repetições, carga, esforço nem técnica', () => {
  const s = serieDeCardio({ duracaoMin: 20, zona: 2 });
  assert.deepEqual(s.cardio, { duracaoMin: 20, distanciaKm: null, ritmo: null, zona: 2, intervalos: null });
  assert.deepEqual([s.tipo, s.repsMin, s.repsMax, s.carga, s.esforco, s.tecnica, s.amrap], [null, null, null, null, null, null, null]);
  conferir([s], true);
});
test('série de cardio sem duração, distância nem intervalos é erro, em vez de sair vazia', () => {
  assert.throws(() => serieDeCardio({ zona: 2 }), /sem duração, distância nem intervalos/);
  assert.throws(() => serieDeCardio({}), /sem duração/);
  assert.doesNotThrow(() => serieDeCardio({ distanciaKm: 3 }));
});
test('exercício de cardio sai de montarSeries com uma série por repetição do item', () => {
  const series = montarSeries([{ n: 2, min: null, max: null, tipo: null, cardio: { duracaoMin: 10, intervalos: { trabalhoSeg: 30, descansoSeg: 30, voltas: 8 } } }], '', REGRA);
  assert.equal(series.length, 2);
  assert.notEqual(series[0].uid, series[1].uid);
  conferir(series, true);
});
test('misturar cardio com série de força no mesmo exercício é erro', () => {
  assert.throws(() => montarSeries(['1x8 - WS', { n: 1, tipo: null, cardio: { duracaoMin: 10 } }], '', REGRA), /só leva séries de cardio/);
});

// ------------------------------------------------------------------------------------------------------- grupos
test('montarGrupos devolve os grupos da sessão com uid novo e o mapa id -> uid', () => {
  const { grupos, uidDe } = montarGrupos([{ id: 'a', tecnica: 'SUPERSET', descansoAposSegundos: 90 }, { id: 'b', tecnica: 'CIRCUITO', voltas: 3 }]);
  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos[0], { uid: uidDe.get('a'), tecnica: 'SUPERSET', descansoAposSegundos: 90, voltas: null });
  assert.deepEqual(grupos[1], { uid: uidDe.get('b'), tecnica: 'CIRCUITO', descansoAposSegundos: null, voltas: 3 });
  assert.notEqual(uidDe.get('a'), uidDe.get('b'));
  assert.deepEqual(montarGrupos().grupos, []);
});
test('montarGrupos recusa técnica fora das sete e grupo sem id ou repetido', () => {
  assert.throws(() => montarGrupos([{ id: 'a', tecnica: 'BI_SET' }]), /Técnica de grupo desconhecida/);
  assert.throws(() => montarGrupos([{ tecnica: 'SUPERSET' }]), /sem id/);
  assert.throws(() => montarGrupos([{ id: 'a', tecnica: 'SUPERSET' }, { id: 'a', tecnica: 'TRI_SET' }]), /repetido/);
  for (const tecnica of TECNICAS_DE_GRUPO) assert.doesNotThrow(() => montarGrupos([{ id: 'a', tecnica }]));
});

// -------------------------------------------------------------------------------------- contrato inteiro do treino
const exercicio = (series, extra = {}) => ({
  uid: randomUUID(), exercicioId: null, nome: 'Exercício fictício', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg',
  series, cadencia: null, isometriaSegundos: null, grupoUid: null, ...extra,
});
const sessao = (exercicios, grupos = []) => ({
  uid: randomUUID(), nome: 'Treino A', diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, exercicios, grupos,
});
test('exercícios, grupos, cardio e todas as séries montadas cabem no contrato (chaves exatas, uids únicos, referências coerentes)', () => {
  const { grupos, uidDe } = montarGrupos([{ id: 'g', tecnica: 'SUPERSET', descansoAposSegundos: 90 }]);
  const completo = montarSeries(['1x10 - Aquecimento', '3x3 - FS', '2x4 a 6 - WS', '1x4 - Top set', '1x8 - Back off'], 'Back off: reduzir 10% da Top set', REGRA, 'LIVRE');
  const comTecnica = montarSeries(['2x8 - WS / 1x8 - Rest Pause', '1x6 (4+2) - Cluster Set, 15 s', '1x8 - WS - Drop-set'], '', REGRA, 'MAQUINA');
  const cardio = montarSeries([{ n: 1, tipo: null, cardio: { duracaoMin: 30, zona: 2 } }], '', REGRA);
  verificarContratoDoTreino({
    sessoes: [sessao([
      exercicio(completo, { grupoUid: uidDe.get('g') }),
      exercicio(comTecnica, { modalidade: 'MAQUINA', grupoUid: uidDe.get('g') }),
      exercicio(cardio, { modalidade: 'CARDIO', unidade: 'kg' }),
    ], grupos)],
  });
});
test('o conferidor de contrato recusa o formato velho', () => {
  const [s] = montarSeries(['1x6 - WS'], '', REGRA);
  const velho = { ...s, intensidade: { modo: 'CARGA_TRABALHO' } };
  delete velho.carga;
  assert.throws(() => verificarContratoDoTreino({ sessoes: [sessao([exercicio([velho])])] }));
  assert.throws(() => verificarContratoDoTreino({ sessoes: [sessao([{ ...exercicio([s]), juntoComAnterior: null }])] }));
  assert.throws(() => verificarContratoDoTreino({ sessoes: [sessao([exercicio([{ ...s, tipo: 'WS' }])])] }), /código/);
});
test('todos os modelos estáticos geram séries somente com o contrato atual', () => {
  const dados = JSON.parse(readFileSync(new URL('./dados/modelos.json', import.meta.url), 'utf8'));
  const modelos = Array.isArray(dados) ? dados : dados.modelos;
  assert.ok(modelos.length > 0);
  for (const m of modelos) {
    const sessoes = m.sessoes.map((sd) => {
      const { grupos, uidDe } = montarGrupos(sd.grupos);
      return sessao(sd.exercicios.map((e) => {
        const itens = e.series.map((s) => (typeof s === 'string' ? s : { n: s.count ?? 1, tipo: s.tipo ?? null, min: null, max: null, cardio: s.cardio }));
        const deCardio = itens.length > 0 && itens.every((i) => typeof i !== 'string' && i.cardio);
        const series = montarSeries(itens, e.obs, REGRA, deCardio ? null : 'LIVRE');
        assert.ok(series.every((s) => !Object.hasOwn(s, 'alvoTexto') && !Object.hasOwn(s, 'intensidade') && s.carga?.modo !== 'LIVRE'));
        return exercicio(series, { modalidade: deCardio ? 'CARDIO' : 'LIVRE', grupoUid: e.grupo ? uidDe.get(e.grupo) : null });
      }), grupos);
    });
    verificarContratoDoTreino({ sessoes });
  }
});

test('o padrão do importador é igual ao padrão do app', async () => {
  const { CONFIGURACAO_PADRAO } = await import('../../app/src/dominio/metodologiaPadrao.ts');
  assert.deepEqual(METODOLOGIA, CONFIGURACAO_PADRAO);
});

test('problemasDosGrupos recusa, antes de gravar, o grupo que o ValidadorTreino recusaria', () => {
  const ex = (grupoUid) => ({ uid: randomUUID(), grupoUid });
  const sup = { uid: 'g1', tecnica: 'SUPERSET', descansoAposSegundos: 90, voltas: null };
  assert.deepEqual(problemasDosGrupos([sup], [ex('g1'), ex('g1'), ex(null)]), []);
  assert.match(problemasDosGrupos([sup], [ex('g1'), ex(null), ex('g1')]).join(), /um ao lado do outro/);
  assert.match(problemasDosGrupos([sup], [ex('g1')]).join(), /pelo menos 2/);
  assert.match(problemasDosGrupos([{ ...sup, tecnica: 'GIANT_SET' }], [ex('g1'), ex('g1'), ex('g1')]).join(), /pelo menos 4/);
  assert.match(problemasDosGrupos([{ ...sup, tecnica: 'PRE_EXAUSTAO' }], [ex('g1'), ex('g1')]).join(), /não tem descanso/);
  assert.match(problemasDosGrupos([{ ...sup, tecnica: 'CIRCUITO' }], [ex('g1'), ex('g1'), ex('g1')]).join(), /1 a 20 voltas/);
  assert.match(problemasDosGrupos([sup], Array.from({ length: 7 }, () => ex('g1'))).join(), /até 6/);
  assert.match(problemasDosGrupos([sup], []).join(), /sem exercícios/);
});
