// Apoio dos testes: confere o conteúdo de treino que os conversores geram contra o contrato atual (os records de
// `api/.../treino/ConteudoTreino.java`, o `ValidadorTreino` e o espelho em `app/src/api/tipos.ts`). Só dados fictícios.
// Nenhum teste de verdade aqui: o arquivo não casa com o padrão `*.test.mjs`.
import assert from 'node:assert/strict';

import METODOLOGIA from './metodologia-padrao.json' with { type: 'json' };

const ordenadas = (o) => Object.keys(o).sort();

/** Chaves exatas de cada record (qualquer chave a mais, como `intensidade` ou `juntoComAnterior`, ou a menos, falha). */
export const CHAVES = {
  sessao: ['cardio', 'diaSemana', 'exercicios', 'frequenciaSemanal', 'grupos', 'nome', 'observacao', 'tipo', 'uid'],
  grupo: ['descansoAposSegundos', 'tecnica', 'uid', 'voltas'],
  exercicio: ['cadencia', 'exercicioId', 'grupoUid', 'isometriaSegundos', 'modalidade', 'nome', 'observacao', 'progressao', 'series', 'unidade', 'uid', 'videoUrl'],
  serie: ['alvoExtra', 'amrap', 'cardio', 'carga', 'descansoSegundos', 'esforco', 'repsMax', 'repsMin', 'tecnica', 'tipo', 'uid'],
  carga: ['modo', 'percentualMax', 'percentualMin', 'referenciaUid'],
  esforco: ['rir', 'rpe'],
  tecnica: [
    'blocos', 'miniSeries', 'pausaRespiracoes', 'pausaSegundos', 'pausas', 'quedas', 'reducaoPercentual', 'regiao', 'repsAssistidas', 'repsParciais',
    'repsPorMiniSerie', 'repsPorQueda', 'tipo',
  ],
};
for (const k of Object.keys(CHAVES)) CHAVES[k].sort();
export const MODOS =['CARGA_TRABALHO', 'PERCENTUAL_WS', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR', 'ABAIXO_DA_REFERENCIA', 'NENHUMA'];
export const CODIGOS = METODOLOGIA.tipos.map((t) => t.codigo);
export const TECNICAS = METODOLOGIA.tecnicas.map((t) => t.tipo);
export const TECNICAS_DE_GRUPO = METODOLOGIA.combinacoes.map((c) => c.tipo);

/** Confere a série (de um exercício que já se sabe de cardio ou não) e devolve o uid, para quem a referenciar. */
export function verificarSerie(s, deCardio, anteriores, rotulo) {
  assert.deepEqual(ordenadas(s), CHAVES.serie, `${rotulo}: chaves da série`);
  assert.equal(typeof s.uid, 'string', rotulo);
  if (deCardio) {
    assert.ok(s.cardio && typeof s.cardio === 'object', `${rotulo}: série de cardio sem cardio`);
    assert.deepEqual([s.tipo, s.repsMin, s.repsMax, s.carga, s.esforco, s.tecnica], [null, null, null, null, null, null], `${rotulo}: cardio não tem tipo, reps, carga, esforço nem técnica`);
    assert.ok(s.cardio.duracaoMin != null || s.cardio.distanciaKm != null || s.cardio.intervalos != null, `${rotulo}: cardio precisa de duração, distância ou intervalos`);
    return s.uid;
  }
  assert.equal(s.cardio, null, `${rotulo}: cardio fora de exercício de cardio`);
  assert.ok(CODIGOS.includes(s.tipo), `${rotulo}: tipo "${s.tipo}" não é um código da metodologia padrão`);
  assert.equal((s.repsMin == null), (s.repsMax == null), `${rotulo}: repsMin e repsMax juntos ou nenhum`);
  if (s.amrap) assert.equal(s.repsMin, null, `${rotulo}: AMRAP exclui as repetições`);
  assert.ok(s.carga && MODOS.includes(s.carga.modo), `${rotulo}: carga.modo`);
  assert.deepEqual(ordenadas(s.carga), CHAVES.carga, `${rotulo}: chaves da carga`);
  if (s.carga.modo === 'ABAIXO_DA_REFERENCIA') {
    assert.ok(anteriores.has(s.carga.referenciaUid), `${rotulo}: a referência precisa ser uma série anterior do mesmo exercício`);
    assert.ok(s.carga.percentualMin >= 1 && s.carga.percentualMin <= 50, `${rotulo}: redução de 1 a 50`);
  } else {
    assert.equal(s.carga.referenciaUid, null, `${rotulo}: referenciaUid só no ABAIXO_DA_REFERENCIA`);
  }
  if (s.esforco !== null) {
    assert.deepEqual(ordenadas(s.esforco), CHAVES.esforco, `${rotulo}: chaves do esforço`);
    assert.ok(s.esforco.rir == null || s.esforco.rpe == null, `${rotulo}: RIR ou RPE, nunca os dois`);
    assert.ok(s.esforco.rir != null || s.esforco.rpe != null, `${rotulo}: esforço vazio deveria ser nulo`);
  }
  if (s.tecnica !== null) {
    assert.deepEqual(ordenadas(s.tecnica), CHAVES.tecnica, `${rotulo}: chaves da técnica`);
    assert.ok(TECNICAS.includes(s.tecnica.tipo), `${rotulo}: técnica ${s.tecnica.tipo}`);
    if (s.tecnica.tipo === 'CLUSTER' && s.tecnica.blocos) {
      const soma = s.tecnica.blocos.reduce((a, b) => a + b, 0);
      assert.deepEqual([s.repsMin, s.repsMax], [soma, soma], `${rotulo}: cluster = soma dos blocos`);
    }
  }
  return s.uid;
}

/** Confere sessões, grupos, exercícios e séries do conteúdo de um treino e a unicidade dos uids. */
export function verificarContratoDoTreino(conteudo) {
  const uids = [];
  conteudo.sessoes.forEach((sessao, i) => {
    const cs = `sessao ${i}`;
    assert.deepEqual(ordenadas(sessao), CHAVES.sessao, `${cs}: chaves da sessão`);
    uids.push(sessao.uid);
    const grupos = new Set();
    for (const g of sessao.grupos) {
      assert.deepEqual(ordenadas(g), CHAVES.grupo, `${cs}: chaves do grupo`);
      assert.ok(TECNICAS_DE_GRUPO.includes(g.tecnica), `${cs}: técnica de grupo ${g.tecnica}`);
      grupos.add(g.uid);
      uids.push(g.uid);
    }
    sessao.exercicios.forEach((e, j) => {
      const ce = `${cs} exercício ${j}`;
      assert.deepEqual(ordenadas(e), CHAVES.exercicio, `${ce}: chaves do exercício`);
      uids.push(e.uid);
      assert.ok(e.grupoUid === null || grupos.has(e.grupoUid), `${ce}: grupoUid precisa ser de um grupo da sessão`);
      const anteriores = new Set();
      e.series.forEach((s, k) => {
        anteriores.add(verificarSerie(s, e.modalidade === 'CARDIO', anteriores, `${ce} série ${k}`));
        uids.push(s.uid);
      });
    });
  });
  assert.equal(new Set(uids).size, uids.length, 'uids repetidos');
}
