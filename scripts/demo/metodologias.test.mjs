// As cinco metodologias demo e as séries geradas pelo `popular-modelos.mjs` contra as regras da API
// (`ConfiguracaoConsultoria.validar`/`validarComoMetodologia`, `ConteudoTreino.Carga/Esforco/Tecnica`). Só dados fictícios.
// Rodar: node --test scripts/demo/metodologias.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { series, TIPO_DE_TRABALHO } from './popular-modelos.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const lerJson = (nome) => JSON.parse(readFileSync(join(AQUI, 'dados', nome), 'utf8'));
const { metodologias } = lerJson('metodologias.json');
const padrao = JSON.parse(readFileSync(join(AQUI, '..', 'importacao', 'metodologia-padrao.json'), 'utf8'));

const PAPEIS = ['AQUECIMENTO', 'PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'OUTRO'];
const MODOS = ['CARGA_TRABALHO', 'PERCENTUAL_WS', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR', 'ABAIXO_DA_REFERENCIA', 'NENHUMA'];
const TECNICAS = ['REST_PAUSE', 'CLUSTER', 'DROP_SET', 'MYO_REPS', 'PARTIAL_REPS', 'FORCED_REPS'];
const COMBINACOES = ['SUPERSET', 'AGONISTA_ANTAGONISTA', 'TRI_SET', 'GIANT_SET', 'CIRCUITO', 'PRE_EXAUSTAO', 'POS_EXAUSTAO'];
const NOMES_DE_TECNICA = ['cluster', 'rest pause', 'restpause', 'drop set', 'dropset', 'myo reps', 'myoreps', 'partial reps', 'partialreps', 'forced reps', 'forcedreps'];
const NOMES_DE_COMBINACAO = ['superset', 'super set', 'agonista antagonista', 'agonistaantagonista', 'tri set', 'triset', 'giant set', 'giantset', 'circuito', 'pre exaustao', 'preexaustao', 'pos exaustao', 'posexaustao'];
const ARREDONDAMENTOS = [0.25, 0.5, 1, 2.5];

const chaveDeTipo = (t) => (t ?? '').replace(/[-–—   ]/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
const dentro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Espelho de `Carga.problemas(false)`. */
function problemasDaCarga(c) {
  const modo = c?.modo ?? 'NENHUMA';
  if (!MODOS.includes(modo)) return ['modo'];
  const limite = { PERCENTUAL_WS: 200, ACIMA_DA_ANTERIOR: 100, ABAIXO_DA_REFERENCIA: 50 }[modo];
  const p = [];
  if (limite) {
    if (c.percentualMin == null || c.percentualMin < 1 || c.percentualMin > limite) p.push('percentualMin');
    else if (c.percentualMax != null && (c.percentualMax < c.percentualMin || c.percentualMax > limite)) p.push('percentualMax');
  }
  return p;
}

/** Espelho de `Esforco.problemas()` mais a exigência de RIR ou RPE do padrão. */
function problemasDoEsforco(e) {
  const p = [];
  if (e.rir == null && e.rpe == null) p.push('vazio');
  if (e.rir != null && (e.rir < 0 || e.rir > 5)) p.push('rir');
  if (e.rpe != null && (e.rpe < 1 || e.rpe > 10 || (e.rpe * 2) % 1 !== 0)) p.push('rpe');
  if (e.rir != null && e.rpe != null) p.push('rir+rpe');
  return p;
}

/** Espelho de `Tecnica.problemasDosValores()` (padrões parciais). */
function problemasDaTecnica(t) {
  const p = [];
  const faixa = (v, min, max, campo) => { if (v != null && !dentro(v, min, max)) p.push(campo); };
  const pausa = () => { faixa(t.pausaSegundos, 5, 600, 'pausaSegundos'); faixa(t.pausaRespiracoes, 1, 30, 'pausaRespiracoes'); };
  switch (t.tipo) {
    case 'REST_PAUSE': pausa(); faixa(t.pausas, 1, 5, 'pausas'); break;
    case 'CLUSTER': pausa(); if (t.blocos != null && (t.blocos.length < 2 || t.blocos.length > 10 || t.blocos.some((b) => !dentro(b, 1, 50)))) p.push('blocos'); break;
    case 'DROP_SET': faixa(t.quedas, 1, 5, 'quedas'); faixa(t.reducaoPercentual, 5, 50, 'reducaoPercentual'); faixa(t.repsPorQueda, 1, 50, 'repsPorQueda'); faixa(t.pausaSegundos, 0, 600, 'pausaSegundos'); break;
    case 'MYO_REPS': faixa(t.miniSeries, 2, 10, 'miniSeries'); faixa(t.repsPorMiniSerie, 1, 50, 'repsPorMiniSerie'); pausa(); break;
    case 'PARTIAL_REPS': faixa(t.repsParciais, 1, 30, 'repsParciais'); if (t.regiao != null && !['ALONGADA', 'ENCURTADA', 'LIVRE'].includes(t.regiao)) p.push('regiao'); break;
    case 'FORCED_REPS': faixa(t.repsAssistidas, 1, 5, 'repsAssistidas'); break;
    default: p.push('tipo');
  }
  return p;
}

/** Espelho de `ConfiguracaoConsultoria.validar` + `validarComoMetodologia`: devolve a lista de problemas. */
function problemasDaMetodologia(c) {
  const e = [];
  const nomes = new Set();
  const codigos = new Set();
  let trabalho = false;
  if (!c || !Array.isArray(c.tipos) || c.tipos.length < 1 || c.tipos.length > 20) return ['tipos: de 1 a 20'];
  for (const t of c.tipos) {
    const nome = t.nome?.trim();
    if (!nome || t.nome.length > 30 || nomes.has(chaveDeTipo(t.nome))) e.push(`nome inválido ou repetido: ${t.nome}`);
    nomes.add(chaveDeTipo(t.nome));
    if (typeof t.codigo !== 'string' || !/^[A-Z0-9_]{1,30}$/.test(t.codigo) || codigos.has(t.codigo)) e.push(`código inválido ou repetido: ${nome}`);
    codigos.add(t.codigo);
    if (!PAPEIS.includes(t.papel)) e.push(`papel: ${nome}`);
    trabalho ||= t.papel === 'TRABALHO';
    const r = t.repeticoes;
    if (r && (r.min == null || r.max == null || r.min < 0 || r.max > 500 || r.max < r.min)) e.push(`repetições: ${nome}`);
    if (t.cargaPadrao && problemasDaCarga(t.cargaPadrao).length) e.push(`cargaPadrao: ${nome}`);
    if (t.esforcoPadrao && problemasDoEsforco(t.esforcoPadrao).length) e.push(`esforcoPadrao: ${nome}`);
    for (const [modalidade, v] of Object.entries(t.porModalidade ?? {})) {
      if (!['LIVRE', 'MAQUINA'].includes(modalidade) || !v) { e.push(`porModalidade ${modalidade}: ${nome}`); continue; }
      if (v.carga && problemasDaCarga(v.carga).length) e.push(`porModalidade.carga: ${nome}`);
      if (v.esforco && problemasDoEsforco(v.esforco).length) e.push(`porModalidade.esforco: ${nome}`);
    }
    const regra = t.regraPercentuais;
    if (regra && Object.keys(regra).length) {
      if (t.papel !== 'PREPARACAO') e.push(`regra só em preparação: ${nome}`);
      for (const [k, faixas] of Object.entries(regra)) {
        const ok = /^(10|[1-9])$/.test(k) && faixas?.length === Number(k)
          && faixas.every((f) => f?.min >= 1 && f.min <= 200 && (f.max == null || (f.max >= f.min && f.max <= 200)));
        if (!ok) e.push(`regra ${k}: ${nome}`);
      }
    }
    if (t.explicacao && t.explicacao.length > 500) e.push(`explicação: ${nome}`);
    if ('intensidadePadrao' in t || 'intensidadePorModalidade' in t) e.push(`campo antigo: ${nome}`);
  }
  if (!trabalho) e.push('sem tipo de trabalho');
  const vistasT = new Set();
  for (const t of c.tecnicas ?? []) {
    if (!TECNICAS.includes(t?.tipo) || vistasT.has(t.tipo)) e.push(`técnica ${t?.tipo}`);
    vistasT.add(t?.tipo);
    if (!t.nome?.trim() || t.nome.length > 30 || (t.explicacao ?? '').length > 500) e.push(`técnica texto ${t.tipo}`);
    if (t.padrao && (t.padrao.tipo !== t.tipo || problemasDaTecnica(t.padrao).length)) e.push(`padrão da técnica ${t.tipo}`);
  }
  if (vistasT.size !== TECNICAS.length) e.push('faltam técnicas');
  const vistasC = new Set();
  for (const k of c.combinacoes ?? []) {
    if (!COMBINACOES.includes(k?.tipo) || vistasC.has(k.tipo)) e.push(`combinação ${k?.tipo}`);
    vistasC.add(k?.tipo);
    if (!k.nome?.trim() || k.nome.length > 30 || (k.explicacao ?? '').length > 500) e.push(`combinação texto ${k.tipo}`);
  }
  if (vistasC.size !== COMBINACOES.length) e.push('faltam combinações');
  if (!ARREDONDAMENTOS.includes(Number(c.arredondamentoKg))) e.push('arredondamento');
  if ((c.instrucoesTreino ?? '').length > 20000) e.push('instruções');
  if ((c.rodapePdf ?? '').length > 500) e.push('rodapé');
  // validarComoMetodologia: tipo não pode ter nome de técnica nem de combinação (fixo ou exibido).
  const tecnicas = new Set([...NOMES_DE_TECNICA, ...(c.tecnicas ?? []).map((t) => chaveDeTipo(t.nome))]);
  const combinacoes = new Set([...NOMES_DE_COMBINACAO, ...(c.combinacoes ?? []).map((k) => chaveDeTipo(k.nome))]);
  for (const t of c.tipos) {
    if (tecnicas.has(chaveDeTipo(t.nome))) e.push(`"${t.nome}" é técnica`);
    if (combinacoes.has(chaveDeTipo(t.nome))) e.push(`"${t.nome}" é combinação`);
  }
  return e;
}

test('são cinco metodologias demo, com os nomes de sempre', () => {
  assert.deepEqual(metodologias.map((m) => m.nome), ['Séries tradicionais', 'Feeder + Working sets', 'Rest-pause', 'Back-off sets', 'Drop-set e Cluster']);
});

for (const m of metodologias) {
  test(`${m.nome}: passa nas regras de validarComoMetodologia`, () => {
    assert.deepEqual(problemasDaMetodologia(m.configuracao), []);
  });

  test(`${m.nome}: formato novo, sem campo do contrato antigo nem tipo Cardio`, () => {
    assert.doesNotMatch(JSON.stringify(m.configuracao), /intensidade/);
    for (const t of m.configuracao.tipos) {
      assert.deepEqual(Object.keys(t), ['codigo', 'nome', 'papel', 'repeticoes', 'cargaPadrao', 'esforcoPadrao', 'porModalidade', 'regraPercentuais', 'explicacao']);
      assert.notEqual(chaveDeTipo(t.nome), 'cardio');
    }
    assert.ok(m.configuracao.tipos.some((t) => t.codigo === TIPO_DE_TRABALHO), 'o tipo de trabalho das séries demo existe');
  });
}

test('o validador espelhado recusa o que a API recusa', () => {
  const com = (alterar) => { const c = structuredClone(metodologias[1].configuracao); alterar(c); return problemasDaMetodologia(c); };
  assert.ok(com((c) => { c.tipos[0].codigo = 'aquecimento'; }).length);
  assert.ok(com((c) => { c.tipos[1].codigo = c.tipos[0].codigo; }).length);
  assert.ok(com((c) => { c.tipos[2].esforcoPadrao = { rir: null, rpe: null }; }).length);
  assert.ok(com((c) => { c.tipos[2].esforcoPadrao = { rir: 1, rpe: 7 }; }).length);
  assert.ok(com((c) => { c.tipos[2].esforcoPadrao = { rir: null, rpe: 7.3 }; }).length);
  assert.ok(com((c) => { c.tipos[2].regraPercentuais = { 1: [{ min: 85, max: null }] }; }).length);
  assert.ok(com((c) => { c.tipos[0].nome = 'Rest pause'; }).length);
  assert.ok(com((c) => { c.tecnicas.pop(); }).length);
  assert.ok(com((c) => { c.combinacoes[0].nome = 'x'.repeat(31); }).length);
  assert.deepEqual(com(() => {}), []);
});

test('as séries do popular-modelos seguem o contrato novo', () => {
  for (const nome of ['Agachamento livre', 'Rosca direta']) {
    const lista = series(nome);
    assert.ok(lista.length >= 3);
    for (const s of lista) {
      assert.equal(s.tipo, 'WORKING');
      assert.deepEqual(s.carga, { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null });
      assert.equal(s.esforco, null);
      assert.equal(s.amrap, null);
      assert.equal(s.cardio, null);
      assert.equal(s.tecnica, null);
      assert.equal(s.alvoExtra, null);
      assert.ok(s.repsMin <= s.repsMax);
      assert.equal('intensidade' in s, false);
      assert.deepEqual(problemasDaCarga(s.carga), []);
    }
  }
  assert.ok(padrao.tipos.some((t) => t.codigo === TIPO_DE_TRABALHO));
});
