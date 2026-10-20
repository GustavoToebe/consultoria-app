// Conversor e importador de planos (dieta e treino), só com dados fictícios montados aqui:
//   node --test scripts/importacao/planos.test.mjs
// A planilha de verdade nunca entra no repositório; os .xlsx destes testes são gerados na memória, e os arquivos dos testes
// de linha de comando ficam numa pasta temporária fora do repositório, apagada no fim. A API é um servidor falso na porta 0.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { lerXlsx } from './planilha-lib.mjs';
import {
  ABAS_LIDAS, TITULO_PASTA, chaveDoExercicio, converterPlanos, destinoDoSuplemento, diaDaSemana, faixaDeRepeticoes, lerArquivoDePlano,
  montarSeries, nomeDoArquivo, resumoDaImportacao, resumoDosPlanos, treinoComBiblioteca, videoValido,
} from './planos-lib.mjs';
import { xlsx, serie } from './xlsx-apoio-teste.mjs';

const HOJE = '2026-10-20';
const CONVERSOR = fileURLToPath(new URL('./converter-planos.mjs', import.meta.url));
const IMPORTADOR = fileURLToPath(new URL('./importar-planos.mjs', import.meta.url));
const REFS = { suplementos: ['Creatina Monohidratada'], ergogenicos: ['Droga Ficticia'] };

const CAB_ALUNOS = ['ID', 'Nome', 'Email', 'Telefone', 'Peso Inicial (kg)', 'Objetivo', 'Data Início', 'Status', 'Obs'];
const CAB_PESOS = ['ID', 'ID Aluno', 'Nome Aluno', 'Data', 'Semana Nº', 'Peso (kg)', 'Variação (kg)', 'Observação'];
const CAB_PLANOS = ['ID Plano', 'ID Aluno', 'Nome Aluno', 'Intra-treino', 'Hidratação', 'Refeição Livre', 'Obs Gerais', 'Data Criação', 'Ativo', 'Versão'];
const CAB_REF = ['ID Ref', 'ID Plano', 'Nº Refeição', 'Título', 'Opção', 'Item Nº', 'Alimento', 'Quantidade (g)', 'Kcal', 'Proteína (g)', 'Carb (g)', 'Gord (g)', 'Dica', 'Unidade Mode', 'Peso Unidade (g)'];
const CAB_SUP = ['ID', 'ID Plano', 'Nome Aluno', 'Suplemento / Medicamento', 'Dose', 'Horário', 'Observação'];
const CAB_ROT = ['ID Rotina', 'ID Aluno', 'Nome Aluno', 'Modelo Base', 'Obs Gerais', 'Recomendações', 'Data Criação', 'Ativo', 'Divisão Semanal', 'Acessórios'];
const CAB_EX = ['ID Exerc', 'ID Rotina', 'Letra Treino', 'Nome Treino', 'Categoria', 'Ordem', 'Nome Exercício', 'WS', 'FS', 'TS', 'BO', 'Rep Range', 'Obs Específica', 'Link Vídeo', 'Back Off %'];

const NOME_GIGANTE = `Exercício ${'muito '.repeat(25)}comprido`; // mais de 120 letras

/** Aluno por linha: [id, nome]. Planos e rotinas montados para cobrir cada regra. */
function abas() {
  return {
    Alunos: [
      CAB_ALUNOS,
      ['AL1', 'Aluno Um', 'um@example.com', null, null, null, null, 'Ativo', null],
      ['AL2', 'Aluno Dois', null, null, null, null, null, 'Ativo', null],
      ['AL4', 'Aluno Quatro', null, null, null, null, null, 'Ativo', null],
      ['AL5', 'Aluno Cinco', null, null, null, null, null, 'Ativo', null],
      ['AL6', 'Aluno Seis', null, null, null, null, null, 'Ativo', null],
    ],
    'Histórico Pesos': [CAB_PESOS],
    Planos: [
      CAB_PLANOS,
      ['P1', 'AL1', 'x', 'Intra fictício', 'Muita água fictícia', null, 'Observação geral fictícia', { data: '2026-01-10' }, true, 1],
      ['P2', 'AL2', 'x', null, null, null, null, { data: '2026-01-10' }, true, 1],
      ['P4a', 'AL4', 'x', null, null, null, null, { data: '2026-01-10' }, true, 1],
      ['P4b', 'AL4', 'x', null, null, null, null, { data: '2026-01-10' }, true, 2],
      ['P5', 'AL5', 'x', null, null, null, null, { data: '2026-01-10' }, false, 1],
      ['P9', 'AL9', 'x', null, null, null, null, { data: '2026-01-10' }, true, 1],
    ],
    Refeições: [
      CAB_REF,
      // P1, refeição 2 (fora de ordem no arquivo), opção única com opção vazia: entra como A
      ['r1', 'P1', 2, 'Almoço fictício', null, 1, 'Feijão fictício', 150, 120, 8, 20, 1, null, 'g', 0],
      // P1, refeição 1
      ['r2', 'P1', 1, 'Café fictício', 'A', 2, 'Pão fictício', 50, 130, 4, 25, 2, 'Pode trocar fictício', 'g', 0],
      ['r3', 'P1', 1, 'Café fictício', 'A', 1, 'Ovo fictício', 2, 140, 12, 1, 10, null, 'un', 50],
      ['r4', 'P1', 1, 'Café fictício', 'B', 1, 'Iogurte fictício', 170, 90, 5, 10, 3, null, 'g', 0],
      ['r5', 'P1', 1, 'Café fictício', null, 3, 'Item sem opção fictício', 10, 10, 1, 1, 1, null, 'g', 0],
      ['r6', 'P1', 1, 'Café fictício', 'A', 4, 'Fruta fictícia', 0, 60, 1, 15, 0, null, 'g', 0],
      ['r7', 'P1', 1, 'Café fictício', 'A', 5, null, null, 1, null, null, null, null, 'g', 0],
      ['r8', 'P2', 1, 'Única fictícia', 'A', 1, 'Aveia fictícia', 30, 110, 4, 19, 2, null, 'g', 0],
      ['r9', 'P4a', 1, 'Não usada', 'A', 1, 'Nada', 1, 1, 1, 1, 1, null, 'g', 0],
    ],
    Suplementos: [
      CAB_SUP,
      ['s1', 'P1', 'x', 'Creatina', '5 g', '08:00', null],
      ['s2', 'P1', 'x', 'Remédio Fictício XYZ', 20, null, null],
      ['s3', 'P1', 'x', 'Droga Ficticia 10mg', '1 ml', 'noite', null],
      ['s4', 'P1', 'x', null, '1', null, null],
    ],
    Treinos_Rotinas: [
      CAB_ROT,
      ['R1', 'AL1', 'x', 'Modelo', 'Obs rotina fictícia', 'Recomendação fictícia', { data: '2026-01-10' }, true, 'Segunda: A | Terça: B', 'Acessórios fictícios'],
      ['R2', 'AL2', 'x', 'Modelo', null, null, { data: '2026-01-10' }, false, null, null],
      ['R6', 'AL6', 'x', 'Modelo', null, null, { data: '2026-01-10' }, true, null, null],
    ],
    Treinos_Exercicios: [
      CAB_EX,
      ['e1', 'R1', 'A', 'Segunda - Costas', 'Principal', 2, 'Remada fictícia', 1, 3, false, true, '3a6', 'Obs fictícia', 'https://youtu.be/abc123', 0.85],
      ['e2', 'R1', 'A', 'Segunda - Costas', 'Principal', 1, 'Puxada fictícia', 3, 0, false, false, '6a8', null, null, 0.8],
      ['e3', 'R1', 'B', 'Treino B', 'Principal', 1, 'Exercício data', 1, 2, false, true, 46364, null, null, 0.9],
      ['e4', 'R1', 'B', 'Treino B', 'Principal', 2, 'Exercício WS 23', 23, 4, false, false, 8, null, null, 0.8],
      ['e5', 'R1', 'B', 'Treino B', 'Principal', 3, NOME_GIGANTE, 2, 1, true, false, '8a10', null, 'http://exemplo.com/video', 0],
      ['e6', 'R2', 'A', 'Treino A', 'Principal', 1, 'Rotina inativa', 1, 1, false, false, '3a6', null, null, 0],
      ['e7', 'R9', 'A', 'Treino A', 'Principal', 1, 'Rotina inexistente', 1, 1, false, false, '3a6', null, null, 0],
      ['e8', 'R6', 'A', 'Treino A', 'Principal', 1, 'Sem série', null, null, false, false, '3a6', null, null, 0],
    ],
    // A tabela de terceiros: o conversor não pode nem abrir esta aba.
    TACO: [['Alimento', 'Energia'], ['Algo', 1]],
  };
}
const planilhaFicticia = (opcoes) => xlsx(abas(), opcoes);

// ---------------------------------------------------------------------------------------------- limites da API

/** Espelho dos `@Size` e `@Size(max)` de listas dos records Java (qualquer excesso derrubaria o PUT do rascunho inteiro). */
function violacoes(tipo, c) {
  const v = [];
  const max = (t, n, rotulo) => { if (typeof t === 'string' && t.length > n) v.push(`${rotulo} ${t.length}>${n}`); };
  const lista = (l, n, rotulo) => { if (Array.isArray(l) && l.length > n) v.push(`${rotulo} ${l.length}>${n}`); };
  if (tipo === 'treino') {
    max(c.objetivo, 200, 'objetivo'); max(c.orientacoes, 8000, 'orientacoes'); lista(c.sessoes, 20, 'sessoes');
    for (const s of c.sessoes) {
      max(s.nome, 80, 'sessao.nome'); lista(s.exercicios, 40, 'exercicios');
      for (const e of s.exercicios) {
        max(e.nome, 120, 'exercicio.nome'); max(e.observacao, 1000, 'exercicio.obs'); max(e.videoUrl, 500, 'video'); lista(e.series, 30, 'series');
        for (const x of e.series) { max(x.tipo, 30, 'serie.tipo'); max(x.intensidade.texto, 120, 'intensidade.texto'); }
      }
    }
  } else {
    max(c.objetivo, 200, 'objetivo'); max(c.observacoes, 8000, 'observacoes'); lista(c.refeicoes, 12, 'refeicoes'); lista(c.orientacoes, 30, 'orientacoes');
    lista(c.suplementacao, 40, 'suplementacao'); lista(c.ergogenicos, 40, 'ergogenicos');
    for (const r of c.refeicoes) {
      max(r.nome, 80, 'refeicao.nome'); max(r.observacao, 1000, 'refeicao.obs'); lista(r.opcoes, 6, 'opcoes');
      for (const o of r.opcoes) { max(o.rotulo, 10, 'rotulo'); lista(o.itens, 40, 'itens'); for (const i of o.itens) { max(i.nome, 160, 'item.nome'); max(i.unidade, 5, 'unidade'); } }
    }
    for (const o of c.orientacoes) { max(o.titulo, 80, 'orientacao.titulo'); max(o.texto, 2000, 'orientacao.texto'); }
    for (const s of c.suplementacao) { max(s.nome, 120, 'supl.nome'); max(s.dose, 120, 'supl.dose'); max(s.horario, 120, 'supl.horario'); max(s.observacao, 500, 'supl.obs'); }
    for (const e of c.ergogenicos ?? []) { max(e.nome, 120, 'ergo.nome'); max(e.dose, 120, 'ergo.dose'); max(e.horario, 120, 'ergo.horario'); max(e.observacao, 500, 'ergo.obs'); }
  }
  return v;
}

const converter = () => converterPlanos(lerXlsx(planilhaFicticia(), { abas: ABAS_LIDAS }), HOJE, REFS);
const doAluno = (r, codigo) => r.arquivos.find((a) => a.codigo === codigo);
const problemasDe = (r, aba, trecho) => r.problemas.filter((p) => p.aba === aba && p.motivo.includes(trecho));

// ---------------------------------------------------------------------------------------------------- testes

test('a aba TACO nunca é aberta: com a lista de abas, um membro corrompido da TACO passa; sem a lista, a leitura falha', () => {
  // A TACO é a 8ª aba no `abas()`; estraga o CRC da folha dela (sheet8.xml).
  const nomes = Object.keys(abas());
  const folhaTaco = `xl/worksheets/sheet${nomes.indexOf('TACO') + 1}.xml`;
  const buf = planilhaFicticia({ crcErrado: [folhaTaco] });
  const lido = lerXlsx(buf, { abas: ABAS_LIDAS });
  assert.ok(!lido.abas.has('TACO'));
  assert.ok(lido.abas.has('Planos'));
  assert.throws(() => lerXlsx(buf), /corrompido/);
  assert.equal(converterPlanos(lido, HOJE, REFS).arquivos.length, 3);
});

test('treino: sessões por letra, exercícios pela Ordem, séries FS/WS/Top set/Back off pela metodologia', () => {
  const r = converter();
  const aluno = doAluno(r, 'AL1');
  const sessoes = aluno.treino.conteudo.sessoes;
  assert.deepEqual(sessoes.map((s) => [s.nome, s.diaSemana, s.tipo]), [['Segunda - Costas', 1, 'TREINO'], ['Treino B', null, 'TREINO']]);
  assert.equal(aluno.treino.conteudo.metodologia, null);
  assert.equal(aluno.treino.conteudo.objetivo, null);
  assert.match(aluno.treino.conteudo.orientacoes, /^Divisão semanal: Segunda: A \| Terça: B\n\nAcessórios: Acessórios fictícios\n\nRecomendações: Recomendação fictícia\n\nObservações gerais: Obs rotina fictícia$/);

  const [puxada, remada] = sessoes[0].exercicios;
  assert.deepEqual([puxada.nome, remada.nome], ['Puxada fictícia', 'Remada fictícia']);
  assert.deepEqual(puxada.series.map((s) => [s.tipo, s.repsMin, s.repsMax, s.intensidade.modo]), Array(3).fill(['WS', 6, 8, 'CARGA_TRABALHO']));
  // BO falso ignora o % da coluna Back Off
  assert.ok(!puxada.series.some((s) => s.tipo === 'Back off'));
  assert.deepEqual(
    remada.series.map((s) => [s.tipo, s.repsMin, s.repsMax, s.intensidade.modo, s.intensidade.percentual]),
    [['FS', 3, 3, 'PERCENTUAL_WS', 50], ['FS', 3, 3, 'PERCENTUAL_WS', 70], ['FS', 3, 3, 'PERCENTUAL_WS', 85], ['WS', 3, 6, 'CARGA_TRABALHO', null], ['Back off', 6, 8, 'PERCENTUAL_WS', 85]],
  );
  assert.equal(remada.videoUrl, 'https://youtu.be/abc123');
  assert.equal(remada.observacao, 'Obs fictícia');
  assert.equal(remada.unidade, 'kg');
  assert.equal(remada.progressao, true);
  assert.equal(remada.exercicioId, null);
  assert.ok(remada.series.every((s) => s.descansoSegundos === null && s.tecnica === null));
});

test('treino: Rep Range que virou data, WS absurdo, FS sem regra, nome comprido, link ruim e exercício sem série', () => {
  const r = converter();
  const [data, ws23, gigante] = doAluno(r, 'AL1').treino.conteudo.sessoes[1].exercicios;
  // data do Excel: nunca decodificada
  assert.deepEqual(data.series.map((s) => [s.tipo, s.repsMin, s.intensidade.percentual]), [['FS', null, 70], ['FS', null, 85], ['WS', null, null], ['Back off', null, 90]].map(([t, , p]) => [t, t === 'FS' ? 3 : t === 'Back off' ? 6 : null, p]));
  assert.equal(data.series.find((s) => s.tipo === 'WS').repsMin, null);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'virou data no Excel').length, 1);
  // WS 23: nenhuma série de WS; FS 4: sem regra
  assert.ok(!ws23.series.some((s) => s.tipo === 'WS'));
  assert.deepEqual(ws23.series.map((s) => [s.tipo, s.intensidade.modo]), Array(4).fill(['FS', 'NENHUMA']));
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'quantidade de WS acima de 10').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'FS sem regra').length, 1);
  // nome > 120: cortado, inteiro na observação; link http recusado; TS verdadeiro vira Top set livre; BO com % 0 não é problema se BO falso
  assert.equal(gigante.nome.length <= 120, true);
  assert.ok(gigante.observacao.startsWith(`Nome completo: ${NOME_GIGANTE}`));
  assert.equal(gigante.videoUrl, null);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'link de vídeo não aceito').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'nome do exercício com mais de 120').length, 1);
  assert.deepEqual(gigante.series.map((s) => [s.tipo, s.intensidade.modo]), [['FS', 'PERCENTUAL_WS'], ['WS', 'CARGA_TRABALHO'], ['WS', 'CARGA_TRABALHO'], ['Top set', 'LIVRE']]);
  assert.equal(gigante.series.find((s) => s.tipo === 'Top set').repsMin, null);
  assert.equal(gigante.series.find((s) => s.tipo === 'FS').intensidade.percentual, 85);
  // sem série (aluno AL6): o exercício fica no plano, sem séries, para o treinador preencher à mão
  const semSerie = doAluno(r, 'AL6').treino.conteudo.sessoes[0].exercicios;
  assert.deepEqual(semSerie.map((e) => [e.nome, e.series.length]), [['Sem série', 0]]);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'ficou sem série').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Rotinas', 'sem exercícios').length, 0);
});

test('rotina inativa, de aluno que ficou fora ou inexistente vira problema; nunca escolhe uma', () => {
  const r = converter();
  assert.equal(doAluno(r, 'AL2').treino, null);
  assert.equal(problemasDe(r, 'Treinos_Rotinas', 'rotina inativa').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'não existe na aba Treinos_Rotinas').length, 1);
});

test('dieta: refeições, opções, itens, unidades e valores ausentes (nunca zero)', () => {
  const r = converter();
  const dieta = doAluno(r, 'AL1').dieta.conteudo;
  assert.deepEqual(dieta.refeicoes.map((f) => f.nome), ['Café fictício', 'Almoço fictício']);
  const [cafe, almoco] = dieta.refeicoes;
  assert.deepEqual(cafe.opcoes.map((o) => o.rotulo), ['A', 'B']);
  assert.deepEqual(cafe.opcoes[0].itens.map((i) => i.nome), ['Ovo fictício', 'Pão fictício', 'Fruta fictícia']);
  const [ovo, pao, fruta] = cafe.opcoes[0].itens;
  assert.deepEqual([ovo.unidade, ovo.quantidade, ovo.kcal, ovo.proteina, ovo.carboidrato, ovo.gordura], ['un', 2, 140, 12, 1, 10]);
  assert.deepEqual([pao.unidade, pao.quantidade, pao.manual, pao.alimentoId], ['g', 50, true, null]);
  assert.equal(fruta.quantidade, null); // quantidade 0 na planilha = ausente
  assert.equal(fruta.kcal, 60);
  assert.equal(cafe.observacao, 'Pão fictício: Pode trocar fictício');
  assert.equal(cafe.horario, null);
  assert.deepEqual(almoco.opcoes.map((o) => [o.rotulo, o.itens.length]), [['A', 1]]); // opção vazia, sem outras: A
  assert.deepEqual(dieta.orientacoes, [{ titulo: 'Intra-treino', texto: 'Intra fictício' }, { titulo: 'Hidratação', texto: 'Muita água fictícia' }]);
  assert.equal(dieta.observacoes, 'Observação geral fictícia');
  assert.equal(dieta.aguaLitros, null);
  assert.equal(problemasDe(r, 'Refeições', 'item sem opção').length, 1);
  assert.equal(problemasDe(r, 'Refeições', 'quantidade ausente, zero').length, 1);
  assert.equal(problemasDe(r, 'Refeições', 'item sem alimento').length, 1);
});

test('suplementos: o que não é suplemento conhecido vai para medicação e ergogênicos (sensível)', () => {
  const r = converter();
  const dieta = doAluno(r, 'AL1').dieta.conteudo;
  assert.deepEqual(dieta.suplementacao.map((s) => [s.nome, s.dose, s.horario]), [['Creatina', '5 g', '08:00']]);
  assert.deepEqual(dieta.ergogenicos.map((e) => [e.nome, e.dose, e.principioAtivo]), [['Remédio Fictício XYZ', '20', null], ['Droga Ficticia 10mg', '1 ml', null]]);
  assert.equal(r.contagens.suplementos, 1);
  assert.equal(r.contagens.ergogenicosReconhecidos, 1);
  assert.equal(r.contagens.ergogenicosNaoReconhecidos, 1);
  assert.equal(problemasDe(r, 'Suplementos', 'sem nome').length, 1);
  assert.equal(doAluno(r, 'AL2').dieta.conteudo.ergogenicos, null);
  assert.equal(destinoDoSuplemento('Whey', { suplementos: ['Whey Protein Concentrado'], ergogenicos: [] }), 'suplemento');
  assert.equal(destinoDoSuplemento('Qualquer coisa', REFS), 'ergogenico-nao-reconhecido');
  // o que casa com as duas listas fica com a sensível (a de ergogênicos vence)
  const nasDuas = { suplementos: ['Creatina'], ergogenicos: ['Creatina'] };
  assert.equal(destinoDoSuplemento('Creatina 5 g', nasDuas), 'ergogenico');
  assert.equal(destinoDoSuplemento('Creatina Droga Ficticia', REFS), 'ergogenico');
});

test('plano inativo, repetido ou de aluno fora: problema, sem escolher; só quem tem treino ou dieta ganha arquivo', () => {
  const r = converter();
  assert.deepEqual(r.arquivos.map((a) => a.codigo), ['AL1', 'AL2', 'AL6']);
  assert.equal(doAluno(r, 'AL2').treino, null);
  assert.equal(doAluno(r, 'AL2').dieta.titulo, 'Dieta de Aluno Dois');
  assert.equal(doAluno(r, 'AL1').treino.titulo, 'Treino de Aluno Um');
  assert.equal(doAluno(r, 'AL1').pasta.titulo, TITULO_PASTA);
  assert.equal(problemasDe(r, 'Planos', 'mais de um plano ativo').length, 2);
  assert.equal(problemasDe(r, 'Planos', 'plano inativo').length, 1);
  assert.equal(problemasDe(r, 'Planos', 'não está entre os alunos convertidos').length, 1);
  assert.deepEqual(r.contagens, { ...r.contagens, alunosNaPlanilha: 5, alunosComTreino: 2, alunosComDieta: 2, alunosComAmbos: 1 });
});

test('o JSON respeita os limites da API, tem uids únicos e não tem zero no lugar de ausente', () => {
  const r = converter();
  for (const a of r.arquivos) {
    for (const tipo of ['treino', 'dieta']) if (a[tipo]) assert.deepEqual(violacoes(tipo, a[tipo].conteudo), [], `${a.codigo} ${tipo}`);
    const uids = JSON.stringify(a).match(/"uid": ?"[0-9a-f-]{36}"/g) ?? [];
    assert.equal(new Set(uids).size, uids.length);
  }
  // campos que a planilha não tem ficam nulos
  const e = doAluno(r, 'AL1').treino.conteudo.sessoes[0].exercicios[0];
  assert.deepEqual([e.cadencia, e.isometriaSegundos, e.juntoComAnterior, e.combinacao, e.modalidade], [null, null, null, null, null]);
  const item = doAluno(r, 'AL2').dieta.conteudo.refeicoes[0].opcoes[0].itens[0];
  assert.deepEqual([item.fatorCorrecao, item.fatorCoccao, item.alimentoId], [null, null, null]);
});

test('problemas só têm aba, linha e motivo, sem nome, alimento, observação nem peso; o resumo só traz contagens', () => {
  const r = converter();
  const csv = JSON.stringify(r.problemas) + resumoDosPlanos(r).join('\n');
  assert.ok(!/Aluno Um|Aluno Dois|fictíci|Remada|Puxada|Creatina|Remédio|Droga|example\.com/i.test(csv));
  assert.ok(r.problemas.every((p) => typeof p.linha === 'number' && p.aba && p.motivo));
});

test('regras pequenas: faixa de repetições, dia da semana, vídeo, séries e nome de arquivo', () => {
  const t = (valor) => faixaDeRepeticoes(valor === null ? undefined : typeof valor === 'number' ? { tipo: 'numero', valor } : { tipo: 'texto', valor });
  assert.deepEqual(t('6a8'), { min: 6, max: 8 });
  assert.deepEqual(t('3 - 6'), { min: 3, max: 6 });
  assert.deepEqual(t(8), { min: 8, max: 8 });
  assert.deepEqual(t(serie('2026-12-08')), { erro: 'data' });
  assert.deepEqual(t('8a6'), { erro: 'invalida' });
  assert.deepEqual(t('abc'), { erro: 'invalida' });
  assert.deepEqual(t(null), { erro: 'vazia' });
  assert.deepEqual(['Segunda - Costas', 'Sábado - Pernas', 'Terça-feira', 'Dia 1 - Upper', 'Segundas'].map(diaDaSemana), [1, 6, 2, null, null]);
  assert.equal(videoValido('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(videoValido('http://youtu.be/abc'), false);
  assert.equal(videoValido('https://exemplo.com/abc'), false);
  assert.equal(videoValido('https://user:senha@youtu.be/abc'), false);
  const avisos = [];
  const base = { ws: undefined, fs: undefined, ts: undefined, bo: undefined, backoff: undefined, faixa: { min: 3, max: 6 } };
  assert.deepEqual(montarSeries({ ...base, fs: 1, ws: 1, bo: true, backoff: 0.9 }, (a) => avisos.push(a)).map((s) => s.intensidade.percentual), [85, null, 90]);
  const semPercentual = montarSeries({ ...base, ws: 1, bo: true, backoff: 0 }, (a) => avisos.push(a));
  assert.equal(semPercentual[1].intensidade.modo, 'NENHUMA');
  assert.deepEqual(avisos, ['back off sem percentual válido (série sem intensidade)']);
  assert.deepEqual(montarSeries({ ...base, ws: -1, fs: 1.5 }, () => {}), []);
  const usados = new Set();
  assert.deepEqual(['ALU/1', 'ALU_1', '../x'].map((c) => nomeDoArquivo(c, usados)), ['ALU_1.json', 'ALU_1_2.json', '___x.json']);
});

test('importação: pares da biblioteca, só no catálogo e sem par; treino ganha o exercicioId pelo nome', () => {
  const r = converter();
  const pares = { biblioteca: new Set([chaveDoExercicio('Remada fictícia')]), catalogo: new Set([chaveDoExercicio('Puxada fictícia')]) };
  const c = resumoDaImportacao(r.arquivos, pares);
  assert.deepEqual([c.alunos, c.comTreino, c.comDieta, c.exercicios, c.naBiblioteca, c.soNoCatalogo, c.semPar, c.nomesSemPar.size], [3, 2, 2, 6, 1, 1, 4, 4]);
  const mapa = new Map([[chaveDoExercicio('Remada fictícia'), { id: 'id-remada', modalidade: 'MAQUINA', videoUrl: 'https://youtu.be/da-biblioteca' }]]);
  const novo = treinoComBiblioteca(doAluno(r, 'AL1').treino.conteudo, mapa);
  const remada = novo.sessoes[0].exercicios.find((e) => e.nome === 'Remada fictícia');
  assert.deepEqual([remada.exercicioId, remada.modalidade, remada.videoUrl], ['id-remada', 'MAQUINA', 'https://youtu.be/abc123']);
  assert.equal(novo.sessoes[0].exercicios.find((e) => e.nome === 'Puxada fictícia').exercicioId, null);
  assert.throws(() => lerArquivoDePlano('{"nome":"x"}'), /não é um arquivo do formato/);
  assert.throws(() => lerArquivoDePlano('nada'), /JSON/);
});

// ------------------------------------------------------------------------------------ linha de comando

function pastaTemporaria(t, prefixo) {
  const pasta = mkdtempSync(join(tmpdir(), prefixo));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  return pasta;
}

test('converter-planos: recusa planilha ou saída dentro do repositório; grava um JSON por aluno (nome = código) e problemas.csv', (t) => {
  const pasta = pastaTemporaria(t, 'planos-conversor-');
  const arquivo = join(pasta, 'planilha.xlsx');
  writeFileSync(arquivo, planilhaFicticia({ crcErrado: [`xl/worksheets/sheet${Object.keys(abas()).indexOf('TACO') + 1}.xml`] }));
  const rodar = (...args) => spawnSync(process.execPath, [CONVERSOR, ...args], { encoding: 'utf8' });

  const dentro = rodar('--planilha', fileURLToPath(new URL('./x.xlsx', import.meta.url)), '--saida', join(pasta, 'saida'));
  assert.equal(dentro.status, 1);
  assert.match(dentro.stderr, /planilha está dentro do repositório/);
  const saidaDentro = rodar('--planilha', arquivo, '--saida', fileURLToPath(new URL('./saida-teste', import.meta.url)));
  assert.equal(saidaDentro.status, 1);
  assert.match(saidaDentro.stderr, /saída está dentro do repositório/);

  const simular = rodar('--planilha', arquivo, '--saida', join(pasta, 'saida'), '--simular');
  assert.equal(simular.status, 0, simular.stderr);
  assert.match(simular.stdout, /Simulação: nada foi gravado/);
  assert.throws(() => readdirSync(join(pasta, 'saida')));

  const ok = rodar('--planilha', arquivo, '--saida', join(pasta, 'saida'));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Convertido: 2 alunos com treino, 2 com dieta \(1 com os dois\), de 5 alunos convertidos/);
  assert.ok(!/Aluno Um|Aluno Dois|fictíci/.test(ok.stdout + ok.stderr));
  assert.deepEqual(readdirSync(join(pasta, 'saida')).sort(), ['AL1.json', 'AL2.json', 'AL6.json', 'problemas.csv']);
  const csv = readFileSync(join(pasta, 'saida', 'problemas.csv'), 'utf8');
  assert.match(csv, /^aba;linha;motivo\n/);
  assert.ok(!/Aluno|fictíci/.test(csv));
  if (process.platform !== 'win32') assert.equal(statSync(join(pasta, 'saida', 'AL1.json')).mode & 0o077, 0);
  const plano = lerArquivoDePlano(readFileSync(join(pasta, 'saida', 'AL1.json'), 'utf8'));
  assert.equal(plano.nome, 'Aluno Um');

  const naoXlsx = join(pasta, 'texto.xlsx');
  writeFileSync(naoXlsx, 'não é planilha');
  assert.match(rodar('--planilha', naoXlsx, '--saida', join(pasta, 'outra')).stderr, /Planilha não convertida/);
});

/** API falsa: guarda as requisições, confere o lock otimista e os limites do `@Size`, e lembra pastas e planos criados. */
function apiFalsa({ permissoes = ['ALUNO_LER', 'PASTA_ALTERAR', 'BIBLIOTECA_LER', 'TREINO_ALTERAR', 'DIETA_ALTERAR', 'ERGOGENICO_ALTERAR'], falhasNoPut = 0 } = {}) {
  let falhasRestantes = falhasNoPut;
  const requisicoes = [];
  const pastas = new Map(); // alunoId -> [pasta]
  const planos = new Map(); // `${tipo}:${alunoId}` -> [plano]
  const rascunhos = new Map(); // planoId -> corpo do PUT
  let seq = 0;
  const servidor = createServer(async (req, res) => {
    const corpoTexto = await new Promise((ok) => { const partes = []; req.on('data', (p) => partes.push(p)); req.on('end', () => ok(Buffer.concat(partes).toString('utf8'))); });
    const corpo = corpoTexto ? JSON.parse(corpoTexto) : null;
    const url = new URL(req.url, 'http://x');
    requisicoes.push({ metodo: req.method, caminho: url.pathname });
    const responder = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const rota = `${req.method} ${url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}|id-[a-z0-9-]+/g, ':id')}`;
    const partes = url.pathname.split('/');
    if (rota === 'POST /auth/login') return responder(200, { accessToken: 'token-falso' });
    if (rota === 'GET /eu') return responder(200, { permissoes });
    if (rota === 'GET /alunos') {
      return responder(200, { total: 2, itens: [{ id: 'id-um', nome: 'ALUNO um' }, { id: 'id-quatro', nome: 'Aluno Quatro' }] });
    }
    if (rota === 'GET /exercicios') return responder(200, [{ id: 'id-remada', nome: 'Remada fictícia', modalidade: 'MAQUINA', videoUrl: null }]);
    if (rota === 'GET /alunos/:id/pastas') return responder(200, pastas.get(partes[2]) ?? []);
    if (rota === 'POST /alunos/:id/pastas') {
      const p = { id: `id-pasta-${++seq}`, titulo: corpo.titulo, inicio: corpo.inicio, fim: corpo.fim };
      pastas.set(partes[2], [...(pastas.get(partes[2]) ?? []), p]);
      return responder(200, p);
    }
    const lista = /^(GET|POST) \/alunos\/:id\/planos-(treino|dieta)$/.exec(rota);
    if (lista) {
      const chave = `${lista[2]}:${partes[2]}`;
      if (lista[1] === 'GET') return responder(200, planos.get(chave) ?? []);
      const plano = { id: `id-plano-${++seq}`, pastaId: corpo.pastaId, titulo: corpo.titulo, versao: 7 };
      planos.set(chave, [...(planos.get(chave) ?? []), plano]);
      return responder(200, { plano, rascunho: {}, versoes: [] });
    }
    const rascunho = /^PUT \/planos-(treino|dieta)\/:id\/rascunho$/.exec(rota);
    if (rascunho) {
      if (falhasRestantes > 0) { falhasRestantes--; return responder(422, { codigo: 'PLANO_INVALIDO' }); }
      if (corpo.versao !== 7) return responder(409, { codigo: 'CONFLITO_EDICAO' });
      const v = violacoes(rascunho[1], corpo.conteudo);
      if (v.length) return responder(422, { codigo: 'PLANO_INVALIDO' });
      rascunhos.set(partes[2], { tipo: rascunho[1], corpo });
      return responder(200, {});
    }
    // Excluir = arquivar: o plano some da listagem (como `PlanoServiceBase.listar`, que filtra os arquivados).
    const excluir = /^DELETE \/planos-(treino|dieta)\/:id$/.exec(rota);
    if (excluir) {
      for (const [chave, lista] of planos) planos.set(chave, lista.filter((p) => p.id !== partes[2]));
      return responder(204);
    }
    return responder(404, { codigo: 'ROTA_FALSA' });
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok({ servidor, requisicoes, rascunhos, pastas, url: `http://127.0.0.1:${servidor.address().port}` })));
}

function rodarImportador(args, env) {
  return new Promise((ok) => {
    const filho = spawn(process.execPath, [IMPORTADOR, ...args], { env: { ...process.env, IMPORT_EMAIL: undefined, IMPORT_SENHA: undefined, ...env }, encoding: 'utf8' });
    let saida = '';
    filho.stdout.on('data', (d) => { saida += d; });
    filho.stderr.on('data', (d) => { saida += d; });
    filho.on('close', (status) => ok({ status, saida }));
  });
}

/** Escreve os JSON dos planos da planilha fictícia numa pasta de teste. */
function pastaDePlanos(t) {
  const pasta = pastaTemporaria(t, 'planos-importar-');
  const usados = new Set();
  for (const a of converter().arquivos) writeFileSync(join(pasta, nomeDoArquivo(a.codigo, usados)), JSON.stringify(a));
  return pasta;
}

test('importar-planos --simular: confere sem rede e sem login, mesmo com a API configurada', async (t) => {
  const api = await apiFalsa();
  t.after(() => api.servidor.close());
  const pasta = pastaDePlanos(t);
  const r = await rodarImportador(['--pasta', pasta, '--simular'], { API_URL: api.url });
  assert.equal(r.status, 0, r.saida);
  assert.equal(api.requisicoes.length, 0);
  assert.match(r.saida, /Simulação \(nenhuma API foi chamada, nada foi gravado\): 3 alunos, 2 com treino e 2 com dieta\./);
  assert.match(r.saida, /Exercícios: 6 \(0 na biblioteca do Saraiva, 0 só no catálogo público, 6 sem par; 6 nomes diferentes sem par\)/);
  assert.match(r.saida, /medicação e ergogênicos: 2 itens/);
  assert.ok(!/Aluno Um|fictíci|Remada/.test(r.saida));
});

test('importar-planos: exige um modo, recusa pasta no repositório e arquivo estranho', async (t) => {
  const pasta = pastaDePlanos(t);
  assert.match((await rodarImportador(['--pasta', pasta], {})).saida, /Escolha um modo/);
  assert.match((await rodarImportador(['--pasta', pasta, '--simular', '--gravar'], {})).saida, /Escolha um modo/);
  const dentro = await rodarImportador(['--pasta', fileURLToPath(new URL('./modelos', import.meta.url)), '--simular'], {});
  assert.equal(dentro.status, 1);
  assert.match(dentro.saida, /pasta está dentro do repositório/);
  writeFileSync(join(pasta, 'estranho.json'), '{"x":1}');
  const ruim = await rodarImportador(['--pasta', pasta, '--simular'], {});
  assert.match(ruim.saida, /estranho\.json: não é um arquivo do formato/);
});

test('importar-planos --gravar: pasta, plano e rascunho com a versão do criar; nunca publica; rodar de novo não duplica', async (t) => {
  const api = await apiFalsa();
  t.after(() => api.servidor.close());
  const pasta = pastaDePlanos(t);
  const env = { API_URL: api.url, IMPORT_EMAIL: 'treinador@example.com', IMPORT_SENHA: 'senha-falsa' };

  const r = await rodarImportador(['--pasta', pasta, '--gravar'], env);
  assert.equal(r.status, 0, r.saida);
  assert.match(r.saida, /Gravado como rascunho \(nada publicado\): 1 pastas novas, 1 treinos e 1 dietas\./);
  assert.match(r.saida, /Pulados: 2 sem aluno de mesmo nome/);
  assert.ok(!/Aluno Um|fictíci|senha-falsa|example\.com/.test(r.saida));
  const caminhos = api.requisicoes.map((x) => `${x.metodo} ${x.caminho}`);
  assert.ok(!caminhos.some((c) => /publicar|validar/.test(c)));
  assert.deepEqual(caminhos.filter((c) => !c.startsWith('GET')), [
    'POST /auth/login',
    'POST /alunos/id-um/pastas',
    'POST /alunos/id-um/planos-treino',
    'PUT /planos-treino/id-plano-2/rascunho',
    'POST /alunos/id-um/planos-dieta',
    'PUT /planos-dieta/id-plano-3/rascunho',
  ]);
  const pastaCriada = api.pastas.get('id-um')[0];
  assert.deepEqual([pastaCriada.titulo, pastaCriada.inicio, pastaCriada.fim], [TITULO_PASTA, null, null]);
  const treino = api.rascunhos.get('id-plano-2').corpo;
  assert.equal(treino.titulo, 'Treino de Aluno Um');
  assert.deepEqual([treino.inicio, treino.fim], [null, null]);
  const remada = treino.conteudo.sessoes[0].exercicios.find((e) => e.nome === 'Remada fictícia');
  assert.deepEqual([remada.exercicioId, remada.modalidade], ['id-remada', 'MAQUINA']);
  assert.equal(treino.conteudo.sessoes[0].exercicios.find((e) => e.nome === 'Puxada fictícia').exercicioId, null);
  assert.equal(api.rascunhos.get('id-plano-3').corpo.conteudo.ergogenicos.length, 2);

  const antes = api.requisicoes.length;
  const de_novo = await rodarImportador(['--pasta', pasta, '--gravar'], env);
  assert.equal(de_novo.status, 0, de_novo.saida);
  assert.match(de_novo.saida, /0 pastas novas, 0 treinos e 0 dietas/);
  assert.match(de_novo.saida, /1 já importados/);
  assert.ok(!api.requisicoes.slice(antes).some((x) => x.metodo === 'POST' && x.caminho !== '/auth/login'));
});

test('importar-planos --gravar: o rascunho recusado arquiva o plano vazio e rodar de novo termina o serviço', async (t) => {
  const api = await apiFalsa({ falhasNoPut: 1 });
  t.after(() => api.servidor.close());
  const pasta = pastaDePlanos(t);
  const env = { API_URL: api.url, IMPORT_EMAIL: 'treinador@example.com', IMPORT_SENHA: 'senha-falsa' };

  const falhou = await rodarImportador(['--pasta', pasta, '--gravar'], env);
  assert.equal(falhou.status, 1);
  assert.match(falhou.saida, /Plano do aluno AL1 \(código na planilha\): PUT \/planos-treino\/id-plano-2\/rascunho -> 422 PLANO_INVALIDO/);
  assert.ok(api.requisicoes.some((x) => x.metodo === 'DELETE' && x.caminho === '/planos-treino/id-plano-2'));
  assert.equal(api.rascunhos.size, 0);

  const de_novo = await rodarImportador(['--pasta', pasta, '--gravar'], env);
  assert.equal(de_novo.status, 0, de_novo.saida);
  assert.match(de_novo.saida, /0 pastas novas, 1 treinos e 1 dietas\./);
  assert.equal(api.rascunhos.size, 2);
  assert.equal(api.pastas.get('id-um').length, 1);
});

test('importar-planos --gravar: sem permissão (inclusive ERGOGENICO_ALTERAR) para antes de gravar qualquer coisa', async (t) => {
  const api = await apiFalsa({ permissoes: ['ALUNO_LER', 'PASTA_ALTERAR', 'BIBLIOTECA_LER', 'TREINO_ALTERAR', 'DIETA_ALTERAR'] });
  t.after(() => api.servidor.close());
  const pasta = pastaDePlanos(t);
  const r = await rodarImportador(['--pasta', pasta, '--gravar'], { API_URL: api.url, IMPORT_EMAIL: 'treinador@example.com', IMPORT_SENHA: 'senha-falsa' });
  assert.equal(r.status, 1);
  assert.match(r.saida, /Faltam permissões para este login: ERGOGENICO_ALTERAR\. Nada foi gravado\./);
  assert.ok(!api.requisicoes.some((x) => x.metodo !== 'GET' && x.caminho !== '/auth/login'));
});

test('importar-planos --gravar: sem IMPORT_EMAIL/IMPORT_SENHA não chama a API', async (t) => {
  const api = await apiFalsa();
  t.after(() => api.servidor.close());
  const r = await rodarImportador(['--pasta', pastaDePlanos(t), '--gravar'], { API_URL: api.url });
  assert.equal(r.status, 1);
  assert.match(r.saida, /Defina IMPORT_EMAIL e IMPORT_SENHA/);
  assert.equal(api.requisicoes.length, 0);
});
