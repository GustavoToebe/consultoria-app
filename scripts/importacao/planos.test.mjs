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

import { lerBibliotecaLocal, lerReferenciasDeSuplementos } from './biblioteca-local.mjs';
import {
  ARQUIVO_CORRESPONDENCIAS, csvDeCorrespondencias, decodificarCsv, lerCorrespondencias, linhasDeCorrespondencia, notaDeSemelhanca,
  sugerirDaBiblioteca, vinculosConfirmados,
} from './correspondencias-lib.mjs';
import { lerXlsx } from './planilha-lib.mjs';
import {
  ABAS_LIDAS, MOTIVO_FAIXA_RECUPERADA, TITULO_PASTA, chaveDoExercicio, converterPlanos, destinoDoSuplemento, diaDaSemana, faixaDeRepeticoes,
  lerArquivoDePlano, montarSeries, nomeDeSuplementoNormalizado, nomeDoArquivo, resumoDaImportacao, resumoDosPlanos, suplementoComumNoComeco,
  treinoComBiblioteca, videoValido,
} from './planos-lib.mjs';
import { xlsx, serie } from './xlsx-apoio-teste.mjs';

const HOJE = '2026-10-20';
const CONVERSOR = fileURLToPath(new URL('./converter-planos.mjs', import.meta.url));
const IMPORTADOR = fileURLToPath(new URL('./importar-planos.mjs', import.meta.url));
const REFS = { suplementos: ['Creatina Monohidratada'], comuns: ['Creatina', 'Zinco', 'Whey', 'Whey Protein'], ergogenicos: ['Droga Ficticia'] };

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

test('treino: Rep Range que virou data (recuperada), WS absurdo, FS sem regra, nome comprido, link ruim e exercício sem série', () => {
  const r = converter();
  const [data, ws23, gigante] = doAluno(r, 'AL1').treino.conteudo.sessoes[1].exercicios;
  // data do Excel (08/12/2026): faixa 8 a 12 na WS, anotada para conferir; FS e Back off seguem a metodologia
  assert.deepEqual(data.series.map((s) => [s.tipo, s.repsMin, s.repsMax, s.intensidade.percentual]), [['FS', 3, 3, 70], ['FS', 3, 3, 85], ['WS', 8, 12, null], ['Back off', 6, 8, 90]]);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'recuperada de uma data do Excel').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'virou data no Excel').length, 0);
  assert.equal(r.contagens.faixasRecuperadas, 1);
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
  assert.deepEqual(t(serie('2026-12-08')), { min: 8, max: 12, deData: true });
  assert.deepEqual(t(serie('1999-05-06')), { erro: 'data' });
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

// -------------------------------------------------------------------------- a) faixa que o Excel virou data

const numero = (valor) => ({ tipo: 'numero', valor });
const textoCel = (valor) => ({ tipo: 'texto', valor });

test('faixa que virou data: dia e mês do menor para o maior, não importa se o Excel leu dia/mês ou mês/dia', () => {
  // 6/8 lido como 6 de agosto, 8/6 como 8 de junho (ou o contrário): sempre 6 a 8
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2026-08-06'))), { min: 6, max: 8, deData: true });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2026-06-08'))), { min: 6, max: 8, deData: true });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2026-10-12'))), { min: 10, max: 12, deData: true });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2026-12-10'))), { min: 10, max: 12, deData: true });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2026-12-10') + 0.75)), { min: 10, max: 12, deData: true }); // com hora
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2026-06-20'))), { min: 6, max: 20, deData: true }); // dia acima de 12
  // janela de ano: bordas
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2015-01-02'))), { min: 1, max: 2, deData: true });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2040-12-31'))), { min: 12, max: 31, deData: true });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2014-12-31'))), { erro: 'data' });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('2041-01-01'))), { erro: 'data' });
  assert.deepEqual(faixaDeRepeticoes(numero(serie('1999-05-06'))), { erro: 'data' });
  assert.deepEqual(faixaDeRepeticoes(numero(600)), { erro: 'data' }); // inteiro acima de 500 que seria uma data de 1901
  assert.deepEqual(faixaDeRepeticoes(numero(-3)), { erro: 'invalida' });
  assert.deepEqual(faixaDeRepeticoes(numero(8)), { min: 8, max: 8 }); // número pequeno continua sendo repetição fixa
});

test('faixa que virou data: texto de data, dia ou mês acima de 50, ano impossível e sistema de datas de 1904', () => {
  const t = (v) => faixaDeRepeticoes(textoCel(v));
  for (const [escrito, esperado] of [
    ['6/8', [6, 8]], ['8/6', [6, 8]], ['12/10', [10, 12]], ['06/08/2026', [6, 8]], ['10/12/26', [10, 12]], ['2026-08-06', [6, 8]],
    ['2026-08-06T00:00:00', [6, 8]], ['2026-08-06 00:00:00', [6, 8]], ['06-08-2026', [6, 8]], [' 6 / 8 ', [6, 8]], ['8/50', [8, 50]],
  ]) assert.deepEqual(t(escrito), { min: esperado[0], max: esperado[1], deData: true }, escrito);
  for (const impossivel of ['6/60', '51/8', '0/8', '6/8/1999', '6/8/2099', '2026-13-60']) assert.deepEqual(t(impossivel), { erro: 'data' }, impossivel);
  // o que já era faixa escrita continua como era; "12-10" (invertida, sem ano) não é data
  assert.deepEqual(t('6-8'), { min: 6, max: 8 });
  assert.deepEqual(t('12-10'), { erro: 'invalida' });
  assert.deepEqual(t('6a8'), { min: 6, max: 8 });
  // sistema de 1904: o mesmo dia tem serial 1462 a menos; sem a flag o dia e o mês sairiam errados
  const em1904 = serie('2026-08-06') - 1462;
  assert.deepEqual(faixaDeRepeticoes(numero(em1904), true), { min: 6, max: 8, deData: true });
  assert.notDeepEqual(faixaDeRepeticoes(numero(em1904), false), { min: 6, max: 8, deData: true });
});

test('faixa que virou data: a conversão não depende do fuso do computador', (t) => {
  // O script roda em outro processo, com o fuso trocado, e fica numa pasta temporária fora do repositório.
  const pasta = pastaTemporaria(t, 'planos-fuso-');
  const script = join(pasta, 'fuso.mjs');
  writeFileSync(script, `import { faixaDeRepeticoes } from ${JSON.stringify(new URL('./planos-lib.mjs', import.meta.url).href)};
    console.log(JSON.stringify(faixaDeRepeticoes({ tipo: 'numero', valor: ${serie('2026-08-06') + 0.99} })));`);
  for (const TZ of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Sao_Paulo', 'UTC']) {
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, TZ } });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { min: 6, max: 8, deData: true }, TZ);
  }
});

test('faixa que virou data na planilha: recuperada vira aviso para conferir; impossível continua indo para os problemas', () => {
  const a = abas();
  const linhas = [
    ['Recuperada A', { data: '2026-08-06' }, 1], ['Recuperada B', { data: '2026-06-08' }, 1], ['Recuperada C', { data: '2026-10-12' }, 1],
    ['Texto de data', '6/8', 1], ['Impossível', { data: '1999-05-06' }, 1], ['Texto impossível', '6/60', 1], ['Sem WS', { data: '2026-08-06' }, null],
  ];
  a.Treinos_Exercicios = [CAB_EX, ...linhas.map(([nome, rep, ws], i) => [`x${i}`, 'R1', 'A', 'Treino A', 'Principal', i + 1, nome, ws, null, false, false, rep, null, null, 0])];
  const r = converterPlanos(lerXlsx(xlsx(a), { abas: ABAS_LIDAS }), HOJE, REFS);
  const reps = Object.fromEntries(doAluno(r, 'AL1').treino.conteudo.sessoes[0].exercicios.map((e) => [e.nome, e.series.map((x) => [x.repsMin, x.repsMax])]));
  assert.deepEqual(reps['Recuperada A'], [[6, 8]]);
  assert.deepEqual(reps['Recuperada B'], [[6, 8]]);
  assert.deepEqual(reps['Recuperada C'], [[10, 12]]);
  assert.deepEqual(reps['Texto de data'], [[6, 8]]);
  assert.deepEqual(reps['Impossível'], [[null, null]]);
  assert.deepEqual(reps['Texto impossível'], [[null, null]]);
  assert.deepEqual(reps['Sem WS'], []);
  assert.equal(r.problemas.filter((p) => p.tipo === MOTIVO_FAIXA_RECUPERADA).length, 4);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'virou data no Excel').length, 2);
  assert.equal(r.contagens.faixasRecuperadas, 4);
  assert.match(resumoDosPlanos(r).join('\n'), /4 faixas de repetições recuperadas/);
  // o aviso não leva os números nem o nome do exercício
  assert.ok(!/Recuperada|\d/.test(MOTIVO_FAIXA_RECUPERADA));
});

// ---------------------------------------------------------------------------------------- c) suplementos

test('suplementos: normalização sem acento, caixa, parênteses, dose e unidade', () => {
  for (const [entrada, esperado] of [
    ['Creatina monohidratada 5g', 'creatina monohidratada'],
    ['Ômega 3 (2 caps) 1000 mg', 'omega 3'],
    ['Vitamina D3 10.000UI', 'vitamina d3'],
    ['Vitamina B12', 'vitamina b12'],
    ['Whey Protein isolado - 1 scoop', 'whey protein isolado'],
    ['  Cafeína  200 MG ', 'cafeina'],
    ['Beta-Alanina 3,2 g', 'beta alanina'],
    ['Zinco (quelato', 'zinco'],
  ]) assert.equal(nomeDeSuplementoNormalizado(entrada), esperado, entrada);
});

test('suplementos: item da lista comum como palavras inteiras no começo do nome; o mais longo vence', () => {
  const comuns = ['Creatina', 'Whey', 'Whey Protein', 'Zinco', 'Ômega 3', 'Pasta de Amendoim', 'Vitamina D3'];
  const casa = (nome) => suplementoComumNoComeco(nome, comuns);
  assert.equal(casa('Creatina monohidratada 5g'), 'Creatina');
  assert.equal(casa('CREATINA'), 'Creatina');
  assert.equal(casa('Whey Protein isolado'), 'Whey Protein'); // o mais longo, não "Whey"
  assert.equal(casa('whey concentrado (sabor baunilha)'), 'Whey');
  assert.equal(casa('Ômega-3 1000mg 2 caps'), 'Ômega 3');
  assert.equal(casa('Omega 3'), 'Ômega 3');
  assert.equal(casa('Pasta de amendoim integral'), 'Pasta de Amendoim');
  assert.equal(casa('Vitamina D3 10.000UI'), 'Vitamina D3');
  // não casa: palavra no meio, substring, só parte da palavra, item incompleto e vazio
  assert.equal(casa('Comprimido de Zinco'), null);
  assert.equal(casa('Zincoxxx'), null);
  assert.equal(casa('Creatinina'), null);
  assert.equal(casa('Vitamina D 2000UI'), null);
  assert.equal(casa('Pasta'), null);
  assert.equal(casa('5g'), null);
  assert.equal(casa(''), null);
  assert.equal(suplementoComumNoComeco('Creatina', []), null);
});

test('suplementos na conversão: lista comum pelo começo do nome; ergogênico vence; o resto fica na lista sensível', () => {
  const sem = { suplementos: [], comuns: REFS.comuns, ergogenicos: [] };
  assert.equal(destinoDoSuplemento('Creatina monohidratada 5g', sem), 'suplemento-comum');
  assert.equal(destinoDoSuplemento('Comprimido de Zinco', sem), 'ergogenico-nao-reconhecido');
  assert.equal(destinoDoSuplemento('Zincoxxx', sem), 'ergogenico-nao-reconhecido');
  // a lista de ergogênicos continua tendo precedência, mesmo com a palavra da lista comum no começo
  assert.equal(destinoDoSuplemento('Creatina Droga Ficticia', REFS), 'ergogenico');
  assert.equal(destinoDoSuplemento('Zinco com Droga Ficticia 10 mg', REFS), 'ergogenico');
  // sem a lista comum (refs só com as duas listas antigas), nada quebra
  assert.equal(destinoDoSuplemento('Qualquer coisa', { suplementos: [], ergogenicos: [] }), 'ergogenico-nao-reconhecido');
  // com as listas do repositório, a lista comum também casa por palavras contidas (como sempre foi): a palavra no meio ainda vale
  const doRepositorio = lerReferenciasDeSuplementos();
  assert.ok(doRepositorio.suplementos.includes('Magnésio') && doRepositorio.comuns.includes('Magnésio'));
  assert.equal(destinoDoSuplemento('Citrato de Magnésio 400 mg', doRepositorio), 'suplemento');
  assert.equal(destinoDoSuplemento('Magnésio dimalato 400 mg', doRepositorio), 'suplemento');
  assert.equal(destinoDoSuplemento('Zincoxxx', doRepositorio), 'ergogenico-nao-reconhecido');
  assert.equal(destinoDoSuplemento('Remédio Fictício XYZ', doRepositorio), 'ergogenico-nao-reconhecido');

  const a = abas();
  a.Suplementos = [CAB_SUP,
    ['s1', 'P1', 'x', 'Whey Protein isolado 30 g', '1 scoop', null, null],
    ['s2', 'P1', 'x', 'Creatina monohidratada (5g)', null, null, null],
    ['s3', 'P1', 'x', 'Zincoxxx 10 mg', null, null, null],
    ['s4', 'P1', 'x', 'Comprimido de Zinco', null, null, null],
    ['s5', 'P1', 'x', 'Zinco com Droga Ficticia', null, null, null],
    ['s6', 'P1', 'x', 'Remédio Fictício XYZ', null, null, null],
  ];
  const r = converterPlanos(lerXlsx(xlsx(a), { abas: ABAS_LIDAS }), HOJE, REFS);
  const dieta = doAluno(r, 'AL1').dieta.conteudo;
  assert.deepEqual(dieta.suplementacao.map((x) => x.nome), ['Whey Protein isolado 30 g', 'Creatina monohidratada (5g)']); // o nome da planilha não muda
  assert.deepEqual(dieta.ergogenicos.map((x) => x.nome), ['Zincoxxx 10 mg', 'Comprimido de Zinco', 'Zinco com Droga Ficticia', 'Remédio Fictício XYZ']);
  // 'Creatina monohidratada (5g)' casa por palavras contidas com a lista do fornecedor; 'Whey Protein isolado' só pelo começo
  assert.deepEqual([r.contagens.suplementos, r.contagens.suplementosPorPrefixo, r.contagens.ergogenicosReconhecidos, r.contagens.ergogenicosNaoReconhecidos], [2, 1, 1, 3]);
});

// ------------------------------------------------------------------- b) correspondencias-exercicios.csv

/** Biblioteca e catálogo fictícios: `biblioteca` = Map chave -> nome, como o `lerBibliotecaLocal`. */
function paresFicticios() {
  const nomes = ['Supino reto com barra', 'Remada curvada', 'Puxada alta na polia', 'Rosca direta'];
  return { biblioteca: new Map(nomes.map((nome) => [chaveDoExercicio(nome), nome])), catalogo: new Set([chaveDoExercicio('Agachamento livre')]) };
}
const arquivoComExercicios = (...nomes) => ({ treino: { conteudo: { sessoes: [{ exercicios: nomes.map((nome) => ({ nome })) }] } } });
/** Preenche a coluna `confirmado` da linha do nome. */
const confirmar = (csv, nome, valor) => csv.replace(new RegExp(`(^${nome};[^\\n]*;)$`, 'm'), `$1${valor}`);

test('correspondências: só nomes sem par exato; sugestão sem acento e sem diferença de caixa; nota de 0 a 1; sem sugestão abaixo do piso', () => {
  const pares = paresFicticios();
  const { linhas, resumo } = linhasDeCorrespondencia([
    arquivoComExercicios('Supino reto com barra', 'Agachamento livre', 'SUPÍNO RETO COM BARRA  ', 'Remada Curvadda', 'Remada curvadda', 'Xyzzy qwerty'),
    arquivoComExercicios('Remada curvadda', 'Puxada altta polia'),
  ], pares);
  // par exato (biblioteca, mesmo com acento e caixa) e catálogo ficam de fora; nomes que só mudam na caixa somam
  assert.deepEqual(linhas.map((l) => [l.nome, l.ocorrencias, l.sugestao, l.confirmado]), [
    ['Remada Curvadda', 3, 'Remada curvada', ''],
    ['Puxada altta polia', 1, 'Puxada alta na polia', ''],
    ['Xyzzy qwerty', 1, '', ''],
  ]);
  assert.deepEqual([resumo.nomesSemPar, resumo.comSugestao, resumo.semSugestao], [3, 2, 1]);
  assert.equal(linhas.find((l) => l.nome === 'Xyzzy qwerty').nota, ''); // ausente nunca é 0
  for (const l of linhas.filter((x) => x.sugestao)) { const n = Number(l.nota.replace(',', '.')); assert.ok(n >= 0.5 && n <= 1, l.nota); }
  // sugestão sem acento nem caixa: a chave é a mesma
  assert.equal(sugerirDaBiblioteca(chaveDoExercicio('RÓSCA DIRÉTA'), pares.biblioteca).nome, 'Rosca direta');
  assert.equal(sugerirDaBiblioteca(chaveDoExercicio('RÓSCA DIRÉTA'), pares.biblioteca).nota, 1);
  // a nota: igual = 1, nada em comum = 0, palavras trocadas de ordem ainda pontuam
  assert.equal(notaDeSemelhanca('rosca direta', 'rosca direta'), 1);
  assert.equal(notaDeSemelhanca('abc', 'xyz'), 0);
  assert.ok(notaDeSemelhanca('rosca direta', 'direta rosca') > 0.5);
  assert.equal(sugerirDaBiblioteca('qqqq', pares.biblioteca), null);
  assert.equal(sugerirDaBiblioteca('qqqq', new Map()), null);
});

test('correspondências: o arquivo tem BOM, ; e confirmado vazio; lê de volta; só "sim" (caixa e espaços tolerados) vincula', () => {
  const pares = paresFicticios();
  const { linhas } = linhasDeCorrespondencia([arquivoComExercicios('Remada curvadda', 'Rosca diretta', '=Fórmula; "estranha"', 'Puxada altta polia')], pares);
  const csv = csvDeCorrespondencias(linhas);
  assert.ok(csv.startsWith('﻿nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado\n'));
  assert.ok(csv.includes("'=Fórmula"));
  const lidas = lerCorrespondencias(csv);
  assert.deepEqual([...lidas.values()].map((l) => l.confirmado), ['', '', '', '']);
  assert.ok(lidas.has(chaveDoExercicio('=Fórmula; "estranha"'))); // o apóstrofo contra fórmula não faz parte do nome
  assert.equal(vinculosConfirmados(lidas).size, 0);

  const preenchido = confirmar(confirmar(confirmar(csv, 'Remada curvadda', ' SIM '), 'Rosca diretta', 'Sim'), 'Puxada altta polia', 'não');
  assert.deepEqual([...vinculosConfirmados(lerCorrespondencias(preenchido))], [
    [chaveDoExercicio('Remada curvadda'), chaveDoExercicio('Remada curvada')],
    [chaveDoExercicio('Rosca diretta'), chaveDoExercicio('Rosca direta')],
  ]);
  for (const outro of ['s', 'x', 'talvez', 'sim?', '1', 'true', 'nao']) {
    assert.equal(vinculosConfirmados(lerCorrespondencias(confirmar(csv, 'Remada curvadda', outro))).size, 0, outro);
  }
  assert.throws(() => lerCorrespondencias('a;b\n1;2\n'), /não tem as colunas/);
});

test('correspondências: ler o CSV salvo como ANSI (windows-1252) pelo Excel mantém os acentos', () => {
  const csv = 'nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado\r\nExtensão fictícia;2;Extensão de pernas;0,8;sim\r\n';
  const ansi = Buffer.from(csv, 'latin1');
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(ansi));
  assert.equal(decodificarCsv(ansi), csv);
  assert.equal(decodificarCsv(Buffer.from(`﻿${csv}`, 'utf8')), csv); // BOM do UTF-8 sai
  assert.deepEqual([...vinculosConfirmados(lerCorrespondencias(decodificarCsv(ansi)))], [[chaveDoExercicio('Extensão fictícia'), chaveDoExercicio('Extensão de pernas')]]);
});

test('correspondências: regerar preserva o confirmado (e a sugestão confirmada) e não perde linha preenchida', () => {
  const pares = paresFicticios();
  const arquivos = [arquivoComExercicios('Remada curvadda', 'Rosca diretta', 'Puxada altta polia')];
  const primeira = csvDeCorrespondencias(linhasDeCorrespondencia(arquivos, pares).linhas);
  // o treinador confirma uma, recusa outra, troca a sugestão da terceira e confirma; e há uma linha de nome que sumiu da planilha
  const editado = `${confirmar(confirmar(primeira, 'Remada curvadda', 'sim'), 'Rosca diretta', 'não')
    .replace(/^Puxada altta polia;.*$/m, 'Puxada altta polia;1;Remada curvada;0,1;sim')}Nome que sumiu;4;Rosca direta;0,3;sim\n`;
  const anteriores = lerCorrespondencias(editado);

  // a biblioteca ganhou um nome mais parecido e a planilha ganhou uma ocorrência: o que foi confirmado não muda de sugestão
  const maior = { biblioteca: new Map([...pares.biblioteca, [chaveDoExercicio('Remada curvadda com barra'), 'Remada curvadda com barra']]), catalogo: pares.catalogo };
  const segunda = linhasDeCorrespondencia([...arquivos, arquivoComExercicios('Remada curvadda')], maior, anteriores);
  const por = Object.fromEntries(segunda.linhas.map((l) => [l.nome, l]));
  assert.deepEqual([por['Remada curvadda'].confirmado, por['Remada curvadda'].sugestao, por['Remada curvadda'].ocorrencias], ['sim', 'Remada curvada', 2]);
  assert.deepEqual([por['Rosca diretta'].confirmado, por['Rosca diretta'].sugestao], ['não', 'Rosca direta']);
  assert.deepEqual([por['Puxada altta polia'].confirmado, por['Puxada altta polia'].sugestao], ['sim', 'Remada curvada']); // sugestão trocada à mão
  assert.deepEqual([por['Nome que sumiu'].confirmado, por['Nome que sumiu'].ocorrencias], ['sim', 0]);
  assert.deepEqual([segunda.resumo.confirmadosNoArquivo, segunda.resumo.confirmadosSim], [4, 3]);
  // escrever e ler de novo dá os mesmos vínculos
  const volta = vinculosConfirmados(lerCorrespondencias(csvDeCorrespondencias(segunda.linhas)));
  assert.deepEqual([...volta].sort(), [...vinculosConfirmados(anteriores)].sort());
  // sem nada confirmado, o arquivo é gerado de novo por inteiro
  assert.deepEqual(linhasDeCorrespondencia(arquivos, maior, lerCorrespondencias(primeira)).linhas.map((l) => l.confirmado), ['', '', '']);
});

test('importação com vínculos confirmados: só vale sem par exato; destino que não existe fica sem par', () => {
  const r = converter();
  const pares = { biblioteca: new Map([[chaveDoExercicio('Remada fictícia'), 'Remada fictícia']]), catalogo: new Set([chaveDoExercicio('Puxada fictícia')]) };
  const vinculos = new Map([
    [chaveDoExercicio('Exercício data'), chaveDoExercicio('Remada fictícia')], // sem par -> biblioteca
    [chaveDoExercicio('Exercício WS 23'), chaveDoExercicio('Puxada fictícia')], // sem par -> só no catálogo
    [chaveDoExercicio('Remada fictícia'), chaveDoExercicio('Puxada fictícia')], // já tem par exato: ignorado
    [chaveDoExercicio('Sem série'), chaveDoExercicio('Nome que não existe')], // destino inexistente
  ]);
  const c = resumoDaImportacao(r.arquivos, pares, vinculos);
  assert.deepEqual([c.exercicios, c.naBiblioteca, c.soNoCatalogo, c.semPar, c.vinculados, c.vinculosSemDestino], [6, 2, 2, 2, 2, 1]);

  const mapa = new Map([[chaveDoExercicio('Remada fictícia'), { id: 'id-remada', modalidade: 'MAQUINA', videoUrl: 'https://youtu.be/da-biblioteca' }]]);
  const dados = Object.fromEntries(treinoComBiblioteca(doAluno(r, 'AL1').treino.conteudo, mapa, vinculos).sessoes.flatMap((s) => s.exercicios).map((e) => [e.nome, e]));
  assert.deepEqual([dados['Exercício data'].exercicioId, dados['Exercício data'].modalidade, dados['Exercício data'].videoUrl], ['id-remada', 'MAQUINA', 'https://youtu.be/da-biblioteca']);
  assert.equal(dados['Remada fictícia'].exercicioId, 'id-remada');
  assert.equal(dados['Remada fictícia'].videoUrl, 'https://youtu.be/abc123'); // o vídeo da planilha vence
  assert.equal(dados['Exercício WS 23'].exercicioId, null); // destino só no catálogo: não está na biblioteca da API
  assert.equal(dados['Puxada fictícia'].exercicioId, null);
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
  assert.deepEqual(readdirSync(join(pasta, 'saida')).sort(), ['AL1.json', 'AL2.json', 'AL6.json', 'correspondencias-exercicios.csv', 'problemas.csv']);
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

test('converter-planos: grava correspondencias-exercicios.csv (0600) só com nomes sem par; regerar não mexe no que foi confirmado', (t) => {
  const pasta = pastaTemporaria(t, 'planos-correspondencias-');
  const arquivo = join(pasta, 'planilha.xlsx');
  writeFileSync(arquivo, planilhaFicticia());
  const saida = join(pasta, 'saida');
  const rodar = (...extra) => spawnSync(process.execPath, [CONVERSOR, '--planilha', arquivo, '--saida', saida, ...extra], { encoding: 'utf8' });

  const simulado = rodar('--simular');
  assert.equal(simulado.status, 0, simulado.stderr);
  assert.match(simulado.stdout, /Exercícios sem par exato na biblioteca nem no catálogo: 6 nomes diferentes \(\d+ com sugestão da biblioteca, \d+ sem\); 0 linhas já com "confirmado" preenchido no arquivo \(0 "sim"\)/);
  assert.throws(() => readdirSync(saida));

  const primeira = rodar();
  assert.equal(primeira.status, 0, primeira.stderr);
  assert.ok(!/Remada fictícia|Puxada fictícia/.test(primeira.stdout + primeira.stderr));
  const caminho = join(saida, ARQUIVO_CORRESPONDENCIAS);
  const csv = readFileSync(caminho, 'utf8');
  assert.ok(csv.startsWith('﻿nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado\n'));
  assert.equal(csv.trim().split('\n').length, 1 + 6);
  assert.ok(lerCorrespondencias(csv).has(chaveDoExercicio('Remada fictícia')));
  if (process.platform !== 'win32') assert.equal(statSync(caminho).mode & 0o077, 0);

  // o treinador confirma uma linha (em ANSI, como o Excel grava) e o conversor roda de novo
  const editado = csv.replace(/^(Remada fictícia;[^\n]*;)$/m, '$1Sim').replace(/^(Puxada fictícia;[^\n]*;)$/m, '$1não');
  assert.notEqual(editado, csv);
  writeFileSync(caminho, Buffer.from(editado.replace(/^﻿/, ''), 'latin1')); // o ANSI do Excel não tem BOM
  const segunda = rodar();
  assert.equal(segunda.status, 0, segunda.stderr);
  assert.match(segunda.stdout, /2 linhas já com "confirmado" preenchido no arquivo \(1 "sim"\)/);
  const depois = lerCorrespondencias(readFileSync(caminho, 'utf8'));
  assert.deepEqual([depois.get(chaveDoExercicio('Remada fictícia')).confirmado, depois.get(chaveDoExercicio('Puxada fictícia')).confirmado], ['Sim', 'não']);

  writeFileSync(caminho, 'isto;nao;e;o;arquivo\n1;2;3;4;5\n');
  const quebrado = rodar();
  assert.equal(quebrado.status, 1);
  assert.match(quebrado.stderr, /não tem as colunas/);
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

test('importar-planos --simular: usa só as linhas confirmado = sim do correspondencias-exercicios.csv da pasta', async (t) => {
  const pasta = pastaDePlanos(t);
  const destino = lerBibliotecaLocal().biblioteca.values().next().value; // um nome qualquer da biblioteca do repositório
  const arquivo = join(pasta, ARQUIVO_CORRESPONDENCIAS);
  const escrever = (linhas) => writeFileSync(arquivo, `nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado\n${linhas.join('\n')}\n`);

  // sem o arquivo: nada ligado
  assert.match((await rodarImportador(['--pasta', pasta, '--simular'], {})).saida, /Vínculos confirmados \(confirmado = sim\): 0 nomes no arquivo; 0 exercícios ligados/);
  // confirmado vazio, "não" e "talvez" não vinculam; " SIM " vincula (e o destino que não existe fica sem par)
  escrever([`Remada fictícia;1;${destino};0,9;`, `Puxada fictícia;1;${destino};0,9;não`, `Exercício data;1;${destino};0,9;talvez`]);
  assert.match((await rodarImportador(['--pasta', pasta, '--simular'], {})).saida, /0 nomes no arquivo; 0 exercícios ligados/);
  escrever([`Remada fictícia;1;${destino};0,9; SIM `, 'Puxada fictícia;1;Nome que não existe na biblioteca;0,9;sim']);
  const r = await rodarImportador(['--pasta', pasta, '--simular'], {});
  assert.equal(r.status, 0, r.saida);
  assert.match(r.saida, /Exercícios: 6 \(1 na biblioteca do Saraiva, 0 só no catálogo público, 5 sem par; 5 nomes diferentes sem par\)/);
  assert.match(r.saida, /2 nomes no arquivo; 1 exercícios ligados por eles \(já contados acima\) e 1 cujo destino não está/);
  assert.ok(!/Remada|Puxada|fictíci/.test(r.saida));
  // arquivo que não é o de correspondências: erro sem conteúdo
  writeFileSync(arquivo, 'a;b\n1;2\n');
  const ruim = await rodarImportador(['--pasta', pasta, '--simular'], {});
  assert.equal(ruim.status, 1);
  assert.match(ruim.saida, /Arquivo correspondencias-exercicios\.csv: o correspondencias-exercicios\.csv não tem as colunas/);
});

test('importar-planos --gravar: o exercício confirmado ganha o id, a modalidade e o vídeo da biblioteca; o não confirmado, não', async (t) => {
  const api = await apiFalsa();
  t.after(() => api.servidor.close());
  const pasta = pastaDePlanos(t);
  // salvo em ANSI, como o "CSV" comum do Excel
  const csv = [
    'nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado',
    'Puxada fictícia;1;Remada fictícia;0,5;sim',
    'Exercício data;1;Remada fictícia;0,5;não',
    'Exercício WS 23;1;Remada fictícia;0,5;',
  ].join('\r\n');
  writeFileSync(join(pasta, ARQUIVO_CORRESPONDENCIAS), Buffer.from(`${csv}\r\n`, 'latin1'));
  const r = await rodarImportador(['--pasta', pasta, '--gravar'], { API_URL: api.url, IMPORT_EMAIL: 'treinador@example.com', IMPORT_SENHA: 'senha-falsa' });
  assert.equal(r.status, 0, r.saida);
  assert.match(r.saida, /Exercícios gravados sem par na biblioteca: 3; ligados por vínculo confirmado: 1\./);
  assert.ok(!/Remada|Puxada|fictíci/.test(r.saida));
  const exercicios = api.rascunhos.get('id-plano-2').corpo.conteudo.sessoes.flatMap((s) => s.exercicios);
  const por = Object.fromEntries(exercicios.map((e) => [e.nome, e]));
  assert.deepEqual([por['Remada fictícia'].exercicioId, por['Puxada fictícia'].exercicioId, por['Puxada fictícia'].modalidade], ['id-remada', 'id-remada', 'MAQUINA']);
  assert.equal(por['Puxada fictícia'].nome, 'Puxada fictícia'); // o nome da planilha fica
  assert.equal(por['Exercício data'].exercicioId, null);
  assert.equal(por['Exercício WS 23'].exercicioId, null);
});
