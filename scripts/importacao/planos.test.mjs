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
  origemDosVinculos, respostaDeConfirmacao, respostaEmDuvida, respostasEmDuvida, sugerirDaBiblioteca, vinculosConfirmados,
} from './correspondencias-lib.mjs';
import {
  ARQUIVO_CLASSIFICACAO, aplicarClassificacao, csvDeClassificacao, destinoEscolhido, destinosClassificados, destinosNaoEntendidos, lerClassificacao,
  linhasDeClassificacao,
} from './classificacao-suplementos-lib.mjs';
import {
  ARQUIVOS_DO_PACOTE, PASTA_DO_PACOTE, SEM_SUGESTAO, csvDeExerciciosParaConferir, csvDeSuplementosParaConferir, csvDoQueCorrigir, textoDaMensagem,
  textoDoProblema,
} from './pacote-saraiva-lib.mjs';
import { lerCsv } from './alunos-lib.mjs';
import { lerXlsx } from './planilha-lib.mjs';
import {
  ABAS_LIDAS, TITULO_PASTA, chaveDoExercicio, converterPlanos, destinoDoSuplemento, diaDaSemana, faixaDeRepeticoes,
  lerArquivoDePlano, montarSeries, nomeDeSuplementoNormalizado, nomeDoArquivo, resumoDaImportacao, resumoDosPlanos, suplementoComumNoComeco,
  treinoComBiblioteca, videoValido,
} from './planos-lib.mjs';
import { xlsx, serie } from './xlsx-apoio-teste.mjs';
import { verificarContratoDoTreino } from './contrato-apoio-teste.mjs';

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
        for (const x of e.series) { max(x.tipo, 30, 'serie.tipo'); max(x.alvoExtra, 120, 'serie.alvoExtra'); }
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
  assert.deepEqual(puxada.series.map((s) => [s.tipo, s.repsMin, s.repsMax, s.carga.modo]), Array(3).fill(['WORKING', 6, 8, 'CARGA_TRABALHO']));
  // BO falso ignora o % da coluna Back Off
  assert.ok(!puxada.series.some((s) => s.tipo === 'BACK_OFF'));
  assert.deepEqual(
    remada.series.map((s) => [s.tipo, s.repsMin, s.repsMax, s.carga.modo, s.carga.percentualMin]),
    [['FEEDER', 3, 3, 'PERCENTUAL_WS', 50], ['FEEDER', 3, 3, 'PERCENTUAL_WS', 70], ['FEEDER', 3, 3, 'PERCENTUAL_WS', 85], ['WORKING', 3, 6, 'CARGA_TRABALHO', null], ['BACK_OFF', 6, 8, 'PERCENTUAL_WS', 85]],
  );
  assert.equal(remada.videoUrl, 'https://youtu.be/abc123');
  assert.equal(remada.observacao, 'Obs fictícia');
  assert.equal(remada.unidade, 'kg');
  assert.equal(remada.progressao, true);
  assert.equal(remada.exercicioId, null);
  assert.ok(remada.series.every((s) => s.descansoSegundos === null && s.tecnica === null && s.esforco === null && s.cardio === null && s.carga.referenciaUid === null));
  verificarContratoDoTreino(doAluno(r, 'AL1').treino.conteudo);
});

test('treino: Rep Range que virou data (recuperada, só contada), WS absurdo, FS sem regra, nome comprido, link ruim e exercício sem série', () => {
  const r = converter();
  const [data, ws23, gigante] = doAluno(r, 'AL1').treino.conteudo.sessoes[1].exercicios;
  // data do Excel (08/12/2026): faixa 8 a 12 na WS, só contada (não vai para os problemas); FS e Back off seguem a metodologia
  assert.deepEqual(data.series.map((s) => [s.tipo, s.repsMin, s.repsMax, s.carga.percentualMin]), [['FEEDER', 3, 3, 70], ['FEEDER', 3, 3, 85], ['WORKING', 8, 12, null], ['BACK_OFF', 6, 8, 90]]);
  assert.equal(r.problemas.filter((p) => /recuperada/i.test(p.motivo)).length, 0);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'virou data no Excel').length, 0);
  assert.equal(r.contagens.faixasRecuperadas, 1);
  // WS 23: nenhuma série de WS; FS 4: sem regra
  assert.ok(!ws23.series.some((s) => s.tipo === 'WORKING'));
  assert.deepEqual(ws23.series.map((s) => [s.tipo, s.carga.modo]), Array(4).fill(['FEEDER', 'NENHUMA']));
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'quantidade de WS acima de 10').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'FS sem regra').length, 1);
  // nome > 120: cortado, inteiro na observação; link http recusado; TS verdadeiro vira Top set livre; BO com % 0 não é problema se BO falso
  assert.equal(gigante.nome.length <= 120, true);
  assert.ok(gigante.observacao.startsWith(`Nome completo: ${NOME_GIGANTE}`));
  assert.equal(gigante.videoUrl, null);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'link de vídeo não aceito').length, 1);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'nome do exercício com mais de 120').length, 1);
  assert.deepEqual(gigante.series.map((s) => [s.tipo, s.carga.modo]), [['FEEDER', 'PERCENTUAL_WS'], ['WORKING', 'CARGA_TRABALHO'], ['WORKING', 'CARGA_TRABALHO'], ['TOP_SET', 'ACIMA_DA_ANTERIOR']]);
  assert.equal(gigante.series.find((s) => s.tipo === 'TOP_SET').repsMin, null);
  // Top set sem número: sobe sobre a anterior, sem inventar percentual
  assert.deepEqual(gigante.series.find((s) => s.tipo === 'TOP_SET').carga, { modo: 'ACIMA_DA_ANTERIOR', percentualMin: null, percentualMax: null, referenciaUid: null });
  assert.equal(gigante.series.find((s) => s.tipo === 'FEEDER').carga.percentualMin, 85);
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
  assert.deepEqual([e.cadencia, e.isometriaSegundos, e.grupoUid, e.modalidade], [null, null, null, null]);
  // formato novo: sem as chaves do contrato anterior, sem grupos nem cardio (a planilha não os tem)
  assert.ok(!Object.hasOwn(e, 'juntoComAnterior') && !Object.hasOwn(e, 'combinacao'));
  for (const a of r.arquivos) if (a.treino) {
    verificarContratoDoTreino(a.treino.conteudo);
    assert.ok(a.treino.conteudo.sessoes.every((s) => Array.isArray(s.grupos) && s.grupos.length === 0));
  }
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
  assert.deepEqual(montarSeries({ ...base, fs: 1, ws: 1, bo: true, backoff: 0.9 }, (a) => avisos.push(a)).map((s) => s.carga.percentualMin), [85, null, 90]);
  assert.deepEqual(montarSeries({ ...base, fs: 1, ws: 1, ts: true, bo: true, backoff: 0.9 }, () => {}).map((s) => [s.tipo, s.carga.modo, s.carga.referenciaUid]),
    [['FEEDER', 'PERCENTUAL_WS', null], ['WORKING', 'CARGA_TRABALHO', null], ['TOP_SET', 'ACIMA_DA_ANTERIOR', null], ['BACK_OFF', 'PERCENTUAL_WS', null]]);
  const semPercentual = montarSeries({ ...base, ws: 1, bo: true, backoff: 0 }, (a) => avisos.push(a));
  assert.equal(semPercentual[1].carga.modo, 'NENHUMA');
  assert.deepEqual(avisos, ['back off sem percentual válido (série sem carga)']);
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

test('faixa que virou data na planilha: recuperada só entra na contagem do resumo; impossível continua indo para os problemas', () => {
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
  // as quatro recuperadas não geram problema; só os dois valores impossíveis (e nada mais) estão em problemas
  assert.equal(r.problemas.filter((p) => /recuperada/i.test(p.motivo)).length, 0);
  assert.equal(problemasDe(r, 'Treinos_Exercicios', 'virou data no Excel').length, 2);
  // 'Sem WS' tem data mas nenhuma série de WS: não há faixa a recuperar, e a contagem não a inclui (A, B, C e o texto "6/8")
  assert.equal(r.contagens.faixasRecuperadas, 4);
  assert.match(resumoDosPlanos(r).join('\n'), /4 faixas de repetições recuperadas/);
});

// ---------------------------------------------------------------------------------------- c) suplementos

test('suplementos heavy suppz: 22 itens, sem preço, porção ausente continua nula', () => {
  const dados = JSON.parse(readFileSync(new URL('./dados/suplementos-heavysuppz.json', import.meta.url), 'utf8'));
  assert.equal(dados.itens.length, 22);
  assert.equal(dados.itens.filter((i) => i.porcao == null).length, 8);
  assert.ok(dados.itens.every((i) => i.marca === 'Heavy Suppz' && i.nome && i.link && !('preco' in i) && !('descricao' in i)));
});

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
/** Preenche a coluna `confirmado` (a penúltima) da linha do nome, de um CSV com `confirmado` e `nome_correto` em branco. */
const confirmar = (csv, nome, valor) => csv.replace(new RegExp(`(^${nome};[^\\n]*);;$`, 'm'), `$1;${valor};`);
/** Preenche a coluna `nome_correto` (a última) da linha do nome. */
const corrigir = (csv, nome, valor) => csv.replace(new RegExp(`(^${nome};[^\\n]*;)$`, 'm'), `$1${valor}`);

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

test('correspondências: o arquivo tem BOM, ; e confirmado vazio; lê de volta; só sim/s/x/ok (caixa, acento e espaços tolerados) vincula', () => {
  const pares = paresFicticios();
  const { linhas } = linhasDeCorrespondencia([arquivoComExercicios('Remada curvadda', 'Rosca diretta', '=Fórmula; "estranha"', 'Puxada altta polia')], pares);
  const csv = csvDeCorrespondencias(linhas);
  assert.ok(csv.startsWith('﻿nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado;nome_correto\n'));
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
  for (const outro of ['talvez', 'sim?', '1', 'true', 'nao', 'não', 'n', 'N', ' Não ']) {
    assert.equal(vinculosConfirmados(lerCorrespondencias(confirmar(csv, 'Remada curvadda', outro))).size, 0, outro);
  }
  // todas as formas de dizer "sim": sim, s, x, ok, com ou sem acento, em qualquer caixa e com espaços
  for (const sim of ['sim', 'SIM', 'Sim', 's', 'S', 'x', 'X', 'ok', 'OK', 'Ok', ' sim ', 'sím']) {
    assert.equal(vinculosConfirmados(lerCorrespondencias(confirmar(csv, 'Remada curvadda', sim))).size, 1, sim);
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

test('correspondências: respostaDeConfirmacao entende sim e não sem acento, sem caixa e com espaços; o resto não é resposta', () => {
  for (const v of ['sim', 'SIM', ' Sim ', 's', 'S', 'x', 'X', 'ok', 'Ok', 'OK', 'sím']) assert.equal(respostaDeConfirmacao(v), 'sim', v);
  for (const v of ['nao', 'NAO', ' Não ', 'não', 'n', 'N']) assert.equal(respostaDeConfirmacao(v), 'nao', v);
  for (const v of ['', '  ', 'talvez', 'sim?', 'ss', 'xx', 'okay', '1', undefined, null]) assert.equal(respostaDeConfirmacao(v), '', String(v));
});

test('correspondências: nome_correto vincula pelo nome sem acento nem caixa; "sim" junto com o nome é dúvida e não vincula; nome que não existe fica sem destino', () => {
  const pares = paresFicticios();
  const arquivos = [arquivoComExercicios('Remada curvadda', 'Rosca diretta', 'Puxada altta polia', 'Xyzzy qwerty', 'Supino torto')];
  const { linhas } = linhasDeCorrespondencia(arquivos, pares);
  let csv = csvDeCorrespondencias(linhas);
  csv = corrigir(csv, 'Xyzzy qwerty', 'REMADA CURVÁDA'); // sem sugestão: só o nome certo vale
  csv = corrigir(csv, 'Supino torto', 'Exercício que não existe');
  csv = corrigir(confirmar(csv, 'Remada curvadda', 'sim'), 'Remada curvadda', 'Rosca direta'); // os dois: resposta em dúvida, nenhum vale
  csv = corrigir(confirmar(csv, 'Rosca diretta', 'não'), 'Rosca diretta', 'Rosca direta'); // não + nome certo: o nome certo vale
  const lidas = lerCorrespondencias(csv);
  assert.deepEqual([...vinculosConfirmados(lidas)].sort(), [
    [chaveDoExercicio('Rosca diretta'), chaveDoExercicio('Rosca direta')],
    [chaveDoExercicio('Supino torto'), chaveDoExercicio('Exercício que não existe')],
    [chaveDoExercicio('Xyzzy qwerty'), chaveDoExercicio('Remada curvada')],
  ].sort());
  assert.deepEqual(origemDosVinculos(lidas), { sim: 0, corrigidos: 3 });
  // "sim" + nome certo: nem a sugestão nem o nome escrito; a linha do arquivo vai para o resumo
  const duvidas = respostasEmDuvida(lidas);
  assert.deepEqual([...duvidas.keys()], [chaveDoExercicio('Remada curvadda')]);
  assert.ok(Number.isInteger([...duvidas.values()][0]) && [...duvidas.values()][0] >= 2);
  assert.equal(respostaEmDuvida({ confirmado: ' OK ', correcao: ' x ' }), true);
  for (const l of [{ confirmado: 'sim', correcao: ' ' }, { confirmado: 'não', correcao: 'x' }, { confirmado: '', correcao: 'x' }, { confirmado: 'talvez', correcao: 'x' }]) {
    assert.equal(respostaEmDuvida(l), false, JSON.stringify(l));
  }
  // a importação: o que existe na biblioteca liga; o que não existe é contado e nunca cria exercício
  const c = resumoDaImportacao(arquivos, pares, vinculosConfirmados(lidas));
  assert.deepEqual([c.vinculados, c.vinculosSemDestino], [2, 1]);
  // a linha só com nome_correto (confirmado em branco) conta como respondida ao regerar
  const de_novo = linhasDeCorrespondencia(arquivos, pares, lidas);
  assert.deepEqual([de_novo.resumo.comNomeCorreto, de_novo.resumo.emDuvida], [4, 1]);
  assert.equal(de_novo.linhas.find((l) => l.nome === 'Xyzzy qwerty').correcao, 'REMADA CURVÁDA');
  assert.equal(lerCorrespondencias(csvDeCorrespondencias(de_novo.linhas)).get(chaveDoExercicio('Xyzzy qwerty')).correcao, 'REMADA CURVÁDA');
});

test('correspondências: arquivo no formato anterior (sem nome_correto) e o arquivo do Saraiva (cabeçalhos do pacote, "—") são lidos', () => {
  const antigo = lerCorrespondencias('nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado\nRemada curvadda;3;Remada curvada;0,9;sim\n');
  assert.deepEqual([...vinculosConfirmados(antigo)], [[chaveDoExercicio('Remada curvadda'), chaveDoExercicio('Remada curvada')]]);
  assert.equal(antigo.get(chaveDoExercicio('Remada curvadda')).correcao, '');

  const pacote = [
    'Nome na planilha;Quantas vezes aparece;Sugestão do app;Está certo?;Se não, qual é',
    'Remada curvadda;3;Remada curvada;Sim;',
    'Xyzzy qwerty;1;—;;Rosca direta',
    'Puxada altta polia;1;Puxada alta na polia;;',
    'Supino torto;2;—;;',
  ].join('\r\n');
  const lidas = lerCorrespondencias(pacote);
  assert.deepEqual([...vinculosConfirmados(lidas)].sort(), [
    [chaveDoExercicio('Remada curvadda'), chaveDoExercicio('Remada curvada')],
    [chaveDoExercicio('Xyzzy qwerty'), chaveDoExercicio('Rosca direta')],
  ].sort());
  assert.equal(lidas.get(chaveDoExercicio('Xyzzy qwerty')).sugestao, ''); // "—" não é um nome
  assert.equal(lidas.get(chaveDoExercicio('Puxada altta polia')).sugestao, 'Puxada alta na polia');
  // "—" com "sim" não liga a nada
  assert.equal(vinculosConfirmados(lerCorrespondencias('Nome na planilha;Sugestão do app;Está certo?\nSupino torto;—;sim\n')).size, 0);
  assert.throws(() => lerCorrespondencias('Nome na planilha;Sugestão do app\nA;B\n'), /não tem as colunas: confirmado/);
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

// ------------------------------------------------------------------- classificacao-suplementos.csv

/** Planos convertidos de uma planilha fictícia cuja aba Suplementos tem estas linhas: [plano, nome] (P1 = AL1, P2 = AL2). */
function planosComSuplementos(itens, refs = REFS) {
  const a = abas();
  a.Suplementos = [CAB_SUP, ...itens.map(([plano, nome], i) => [`s${i}`, plano, 'x', nome, '1 dose', null, null])];
  return converterPlanos(lerXlsx(xlsx(a), { abas: ABAS_LIDAS }), HOJE, refs).arquivos;
}
const ITENS_DE_CLASSIFICACAO = [
  ['P1', 'Whey Protein isolado 30 g'], // lista comum: não entra no arquivo
  ['P1', 'Droga Ficticia 10 mg'], // lista de ergogênicos: não entra
  ['P1', 'Xilofone Fictício 5 mg'],
  ['P1', 'Zincoxxx 10 mg'],
  ['P2', 'xilofone ficticio (lote 2)'], // mesmo nome normalizado do primeiro
  ['P2', '500 mg'], // sem nome depois de normalizar: não dá para classificar
];
const nomesDe = (lista) => (lista ?? []).map((x) => x.nome);

test('classificação: só o que nenhuma lista reconhece entra, por nome normalizado e com a contagem; destino em branco', () => {
  const { linhas, resumo } = linhasDeClassificacao(planosComSuplementos(ITENS_DE_CLASSIFICACAO), REFS);
  assert.deepEqual(linhas, [
    { nome: 'xilofone ficticio', ocorrencias: 2, destino: '' },
    { nome: 'zincoxxx', ocorrencias: 1, destino: '' },
  ]);
  assert.deepEqual(resumo, { nomesDistintos: 2, itens: 3, semNome: 1, comDestinoNoArquivo: 0, naoEntendidos: 0 });
  // quem a lista comum ou a de ergogênicos reconhece nunca aparece
  assert.ok(!linhas.some((l) => /whey|droga/.test(l.nome)));
  // nenhum item, nenhum problema: só o cabeçalho
  assert.deepEqual(linhasDeClassificacao(planosComSuplementos([['P1', 'Whey Protein']]), REFS).linhas, []);
});

test('classificação: o arquivo tem BOM, ; e destino vazio; lê de volta (CRLF e ANSI do Excel); o que não é destino fica de fora', () => {
  const { linhas } = linhasDeClassificacao(planosComSuplementos(ITENS_DE_CLASSIFICACAO), REFS);
  const csv = csvDeClassificacao(linhas);
  assert.equal(csv, '﻿nome_normalizado;ocorrencias;destino\nxilofone ficticio;2;\nzincoxxx;1;\n');
  assert.equal(csvDeClassificacao([{ nome: '=cmd|"x"; y', ocorrencias: 1, destino: '' }]).split('\n')[1], `"'=cmd|""x""; y";1;`);
  assert.deepEqual([...lerClassificacao(csv).keys()], ['xilofone ficticio', 'zincoxxx']);
  assert.equal(destinosClassificados(lerClassificacao(csv)).size, 0);

  const preenchido = 'nome_normalizado;ocorrencias;destino\r\nXilofone Fictício;2; Suplemento \r\nzincoxxx;1;SENSIVEL\r\nvazio um;1;\r\nvazio dois;1;talvez\r\nvazio tres;1;sensível\r\nvazio quatro;1;s\r\nvazio cinco;1;sei lá\r\n';
  const ansi = Buffer.from(preenchido, 'latin1');
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(ansi));
  const lidas = lerClassificacao(decodificarCsv(ansi));
  assert.deepEqual([...destinosClassificados(lidas)], [['xilofone ficticio', 'suplemento'], ['zincoxxx', 'sensivel'], ['vazio tres', 'sensivel'], ['vazio quatro', 'suplemento']]);
  // o que ninguém entende vem com o número da linha do arquivo (o cabeçalho é a 1); em branco não é "não entendido"
  assert.deepEqual([...destinosNaoEntendidos(lidas)], [['vazio dois', 5], ['vazio cinco', 8]]);
  assert.throws(() => lerClassificacao('a;b\n1;2\n'), /não tem as colunas/);
});

test('classificação: destinoEscolhido entende cada variação (sem acento, caixa, espaços); em branco é vazio e o resto, não entendido', () => {
  for (const v of ['suplemento', 'Suplemento', ' SUPLEMENTO ', 'suplementos', 'Suplementos', 's', 'S']) assert.equal(destinoEscolhido(v), 'suplemento', v);
  for (const v of ['sensivel', 'sensível', 'SENSÍVEL', 'medicamento', 'Medicamento', 'medicacao', 'medicação', 'MEDICAÇÃO', 'm', 'M', ' m ']) {
    assert.equal(destinoEscolhido(v), 'sensivel', v);
  }
  for (const v of ['', '   ', undefined, null]) assert.equal(destinoEscolhido(v), '', String(v));
  for (const v of ['talvez', 'x', 'sim', 'suple', 'ss', 'sensiveis', 'remedio', '1', 'suplemento medicamento']) assert.equal(destinoEscolhido(v), 'nao-entendido', v);
});

test('classificação: o arquivo do Saraiva (cabeçalhos do pacote) é lido direto, com o número da linha dos destinos não entendidos', () => {
  const lidas = lerClassificacao([
    'Nome na planilha;Quantas vezes aparece;Destino',
    'xilofone ficticio;2;Suplemento',
    'zincoxxx;1;medicação',
    'terceiro fictício;1;não sei',
    'quarto ficticio;1;',
  ].join('\r\n'));
  assert.deepEqual([...destinosClassificados(lidas)], [['xilofone ficticio', 'suplemento'], ['zincoxxx', 'sensivel']]);
  assert.deepEqual([...destinosNaoEntendidos(lidas)], [['terceiro ficticio', 4]]);
});

test('classificação: regerar preserva o destino preenchido e não perde linha preenchida de nome que sumiu', () => {
  const arquivos = planosComSuplementos(ITENS_DE_CLASSIFICACAO);
  const anteriores = lerClassificacao('nome_normalizado;ocorrencias;destino\nxilofone ficticio;2;suplemento\nzincoxxx;1;\nnome que sumiu;9;sensivel\nsumiu em branco;4;\n');
  const { linhas, resumo } = linhasDeClassificacao(arquivos, REFS, anteriores);
  assert.deepEqual(linhas.map((l) => [l.nome, l.ocorrencias, l.destino]), [['xilofone ficticio', 2, 'suplemento'], ['zincoxxx', 1, ''], ['nome que sumiu', 0, 'sensivel']]);
  assert.deepEqual([resumo.nomesDistintos, resumo.comDestinoNoArquivo], [2, 2]);
  // escrever e ler de novo dá os mesmos destinos
  assert.deepEqual([...destinosClassificados(lerClassificacao(csvDeClassificacao(linhas)))], [['xilofone ficticio', 'suplemento'], ['nome que sumiu', 'sensivel']]);
  // um nome que passou a ser reconhecido por alguma lista deixa de ser gerado, mas a linha preenchida fica
  const reconhecido = linhasDeClassificacao(arquivos, { ...REFS, comuns: [...REFS.comuns, 'Zincoxxx'] }, anteriores);
  assert.deepEqual(reconhecido.linhas.map((l) => l.nome), ['xilofone ficticio', 'nome que sumiu']);
});

test('classificação na importação: suplemento move para a Suplementação; sensivel, branco e destino não entendido ficam na sensível', () => {
  const planos = planosComSuplementos(ITENS_DE_CLASSIFICACAO);
  const antes = JSON.stringify(planos);
  const destinos = (...linhas) => destinosClassificados(lerClassificacao(['nome_normalizado;ocorrencias;destino', ...linhas].join('\n')));

  // sem arquivo = comportamento atual: tudo o que ninguém reconhece segue na sensível, e conta como não classificado
  const sem = aplicarClassificacao(planos, REFS);
  assert.deepEqual(sem.planos, planos);
  assert.deepEqual(sem.contagens, { suplemento: 0, sensivel: 0, naoClassificado: 4, naoEntendido: 0, semVaga: 0 });

  const r = aplicarClassificacao(planos, REFS, destinos('xilofone ficticio;2; Suplemento ', 'zincoxxx;1;sensivel'));
  assert.equal(JSON.stringify(planos), antes); // a entrada não muda
  assert.deepEqual(r.contagens, { suplemento: 2, sensivel: 1, naoClassificado: 1, naoEntendido: 0, semVaga: 0 });
  const [al1, al2] = ['AL1', 'AL2'].map((c) => r.planos.find((p) => p.codigo === c).dieta.conteudo);
  assert.deepEqual(nomesDe(al1.suplementacao), ['Whey Protein isolado 30 g', 'Xilofone Fictício 5 mg']);
  assert.deepEqual(nomesDe(al1.ergogenicos), ['Droga Ficticia 10 mg', 'Zincoxxx 10 mg']);
  // o item movido tem o formato da Suplementação, com os dados do item (dose) e sem os campos da lista sensível
  assert.deepEqual(Object.keys(al1.suplementacao[1]).sort(), ['dose', 'horario', 'link', 'nome', 'observacao', 'uid']);
  assert.deepEqual([al1.suplementacao[1].dose, al1.suplementacao[1].link], ['1 dose', null]);
  // "500 mg" (sem nome depois de normalizar) não dá para classificar: continua na sensível e conta como não classificado
  assert.deepEqual(nomesDe(al2.suplementacao), ['xilofone ficticio (lote 2)']);
  assert.deepEqual(nomesDe(al2.ergogenicos), ['500 mg']);
  // a lista sensível que esvazia vira null, como no conversor
  assert.equal(aplicarClassificacao(planosComSuplementos([['P1', 'Zincoxxx']]), REFS, destinos('zincoxxx;1;suplemento')).planos[0].dieta.conteudo.ergogenicos, null);

  // em branco: fica na sensível e conta como não classificado (mas não como "destino não entendido")
  const emBranco = aplicarClassificacao(planos, REFS, destinos('xilofone ficticio;2;', 'zincoxxx;1;'));
  assert.deepEqual(emBranco.contagens, { suplemento: 0, sensivel: 0, naoClassificado: 4, naoEntendido: 0, semVaga: 0 });
  assert.deepEqual(emBranco.planos, planos);

  // cada forma de escrever "suplemento" e "sensível" vale (xilofone: 2 itens; zincoxxx: 1 item; o "500 mg" nunca é classificado)
  for (const valor of ['suplemento', 'Suplementos', 's', ' S ']) {
    const x = aplicarClassificacao(planos, REFS, destinos(`xilofone ficticio;2;${valor}`, `zincoxxx;1;${valor}`));
    assert.deepEqual(x.contagens, { suplemento: 3, sensivel: 0, naoClassificado: 1, naoEntendido: 0, semVaga: 0 }, valor);
  }
  for (const valor of ['sensivel', 'sensível', 'Medicamento', 'medicacao', 'MEDICAÇÃO', 'm']) {
    const x = aplicarClassificacao(planos, REFS, destinos(`xilofone ficticio;2;${valor}`, `zincoxxx;1;${valor}`));
    assert.deepEqual(x.contagens, { suplemento: 0, sensivel: 3, naoClassificado: 1, naoEntendido: 0, semVaga: 0 }, valor);
    assert.deepEqual(x.planos, planos, valor); // na sensível desde o começo: nada muda
  }

  // destino que ninguém entende: fica na sensível, conta como não classificado e como "não entendido"
  for (const valor of ['talvez', 'x', 'sim', 'sei lá']) {
    const lidas = lerClassificacao(['nome_normalizado;ocorrencias;destino', `xilofone ficticio;2;${valor}`, `zincoxxx;1;${valor}`].join('\n'));
    const x = aplicarClassificacao(planos, REFS, destinosClassificados(lidas), destinosNaoEntendidos(lidas));
    assert.deepEqual(x.contagens, { suplemento: 0, sensivel: 0, naoClassificado: 4, naoEntendido: 3, semVaga: 0 }, valor);
    assert.deepEqual(x.planos, planos, valor);
  }
});

test('classificação na importação: a lista de ergogênicos vence mesmo com o mesmo nome normalizado; limite da Suplementação respeitado', () => {
  // "Droga Ficticia 10 mg" é da lista de ergogênicos; a linha "droga ficticia;suplemento" (digitada à mão) não pode movê-la
  const planos = planosComSuplementos([['P1', 'Droga Ficticia 10 mg'], ['P1', 'Droga Ficticia (lote 3)'], ['P1', 'Zincoxxx']]);
  const destinos = destinosClassificados(lerClassificacao('nome_normalizado;ocorrencias;destino\ndroga ficticia;2;suplemento\nzincoxxx;1;suplemento\n'));
  const r = aplicarClassificacao(planos, REFS, destinos);
  assert.deepEqual(nomesDe(r.planos[0].dieta.conteudo.ergogenicos), ['Droga Ficticia 10 mg', 'Droga Ficticia (lote 3)']);
  assert.deepEqual(nomesDe(r.planos[0].dieta.conteudo.suplementacao), ['Zincoxxx']);
  assert.deepEqual(r.contagens, { suplemento: 1, sensivel: 0, naoClassificado: 0, naoEntendido: 0, semVaga: 0 });
  // mesmo nome normalizado, com e sem a palavra da lista de ergogênicos: o reconhecido nunca conta como classificado
  const parenteses = planosComSuplementos([['P1', 'Zincoxxx (com Droga Ficticia)'], ['P1', 'Zincoxxx']]);
  const p = aplicarClassificacao(parenteses, REFS, destinosClassificados(lerClassificacao('nome_normalizado;ocorrencias;destino\nzincoxxx;1;suplemento\n')));
  assert.deepEqual(nomesDe(p.planos[0].dieta.conteudo.suplementacao), ['Zincoxxx']);
  assert.deepEqual(nomesDe(p.planos[0].dieta.conteudo.ergogenicos), ['Zincoxxx (com Droga Ficticia)']);

  // a Suplementação já cheia (40): o excedente fica na lista sensível e é contado, nada some
  const cheio = planosComSuplementos([['P1', 'Zincoxxx']]);
  cheio[0].dieta.conteudo.suplementacao = Array.from({ length: 40 }, (_, i) => ({ uid: `u${i}`, nome: `Item ${i}`, dose: null, horario: null, observacao: null, link: null }));
  const lotado = aplicarClassificacao(cheio, REFS, destinosClassificados(lerClassificacao('nome_normalizado;ocorrencias;destino\nzincoxxx;1;suplemento\n')));
  assert.equal(lotado.planos[0].dieta.conteudo.suplementacao.length, 40);
  assert.deepEqual(nomesDe(lotado.planos[0].dieta.conteudo.ergogenicos), ['Zincoxxx']);
  assert.deepEqual(lotado.contagens, { suplemento: 0, sensivel: 0, naoClassificado: 0, naoEntendido: 0, semVaga: 1 });
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
  assert.deepEqual(readdirSync(join(pasta, 'saida')).sort(), ['AL1.json', 'AL2.json', 'AL6.json', 'classificacao-suplementos.csv', 'correspondencias-exercicios.csv', 'problemas.csv']);
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
  assert.match(simulado.stdout, /Exercícios sem par exato na biblioteca nem no catálogo: 6 nomes diferentes \(\d+ com sugestão da biblioteca, \d+ sem\); 0 linhas já respondidas no arquivo \(0 "sim", 0 com o nome certo escrito\)/);
  assert.throws(() => readdirSync(saida));

  const primeira = rodar();
  assert.equal(primeira.status, 0, primeira.stderr);
  assert.ok(!/Remada fictícia|Puxada fictícia/.test(primeira.stdout + primeira.stderr));
  const caminho = join(saida, ARQUIVO_CORRESPONDENCIAS);
  const csv = readFileSync(caminho, 'utf8');
  assert.ok(csv.startsWith('﻿nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado;nome_correto\n'));
  assert.equal(csv.trim().split('\n').length, 1 + 6);
  assert.ok(lerCorrespondencias(csv).has(chaveDoExercicio('Remada fictícia')));
  if (process.platform !== 'win32') assert.equal(statSync(caminho).mode & 0o077, 0);

  // o treinador confirma uma linha (em ANSI, como o Excel grava) e o conversor roda de novo
  const editado = csv.replace(/^(Remada fictícia;[^\n]*);;$/m, '$1;Sim;').replace(/^(Puxada fictícia;[^\n]*);;$/m, '$1;não;');
  assert.notEqual(editado, csv);
  writeFileSync(caminho, Buffer.from(editado.replace(/^﻿/, ''), 'latin1')); // o ANSI do Excel não tem BOM
  const segunda = rodar();
  assert.equal(segunda.status, 0, segunda.stderr);
  assert.match(segunda.stdout, /2 linhas já respondidas no arquivo \(1 "sim", 0 com o nome certo escrito\)/);
  const depois = lerCorrespondencias(readFileSync(caminho, 'utf8'));
  assert.deepEqual([depois.get(chaveDoExercicio('Remada fictícia')).confirmado, depois.get(chaveDoExercicio('Puxada fictícia')).confirmado], ['Sim', 'não']);
  assert.ok(!/em dúvida/.test(segunda.stdout));

  // "sim" e um nome certo na mesma linha: resposta em dúvida, contada no resumo e listada no problemas.csv com a linha (nunca o conteúdo)
  const emDuvida = readFileSync(caminho, 'utf8').replace(/^(Remada fictícia;[^\n]*;Sim);$/m, '$1;Rosca qualquer');
  assert.notEqual(emDuvida, readFileSync(caminho, 'utf8'));
  writeFileSync(caminho, emDuvida);
  const terceira = rodar();
  assert.equal(terceira.status, 0, terceira.stderr);
  assert.match(terceira.stdout, /; 1 respostas em dúvida \(sim e nome certo na mesma linha/);
  assert.ok(!/Rosca qualquer|Remada/.test(terceira.stdout + terceira.stderr));
  const problemas = readFileSync(join(saida, 'problemas.csv'), 'utf8');
  assert.match(problemas, /correspondencias-exercicios\.csv;\d+;resposta em dúvida/);
  assert.ok(!/Rosca qualquer/.test(problemas));
  assert.equal(readFileSync(caminho, 'utf8'), emDuvida); // a resposta da pessoa não é mexida

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

test('importar-planos --simular: usa as linhas com confirmado = sim (ou s, x, ok) e o nome certo do correspondencias-exercicios.csv da pasta', async (t) => {
  const pasta = pastaDePlanos(t);
  const destino = lerBibliotecaLocal().biblioteca.values().next().value; // um nome qualquer da biblioteca do repositório
  const arquivo = join(pasta, ARQUIVO_CORRESPONDENCIAS);
  // formato anterior, sem a coluna nome_correto: continua sendo lido
  const escrever = (linhas) => writeFileSync(arquivo, `nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado\n${linhas.join('\n')}\n`);
  const escreverComNomeCerto = (linhas) => writeFileSync(arquivo, `nome_na_planilha;ocorrencias;sugestao_da_biblioteca;nota_de_semelhanca;confirmado;nome_correto\n${linhas.join('\n')}\n`);

  // sem o arquivo: nada ligado
  assert.match((await rodarImportador(['--pasta', pasta, '--simular'], {})).saida, /Vínculos \(confirmado = sim ou nome certo escrito\): 0 nomes no arquivo \(0 por "sim", 0 por nome corrigido\); 0 exercícios ligados/);
  // confirmado vazio, "não", "n" e "talvez" não vinculam
  escrever([`Remada fictícia;1;${destino};0,9;`, `Puxada fictícia;1;${destino};0,9;não`, `Exercício data;1;${destino};0,9;talvez`, `Sem série;1;${destino};0,9;N`]);
  assert.match((await rodarImportador(['--pasta', pasta, '--simular'], {})).saida, /0 nomes no arquivo \(0 por "sim", 0 por nome corrigido\); 0 exercícios ligados/);
  // " SIM " vincula (e o destino que não existe fica sem par)
  escrever([`Remada fictícia;1;${destino};0,9; SIM `, 'Puxada fictícia;1;Nome que não existe na biblioteca;0,9;sim']);
  const r = await rodarImportador(['--pasta', pasta, '--simular'], {});
  assert.equal(r.status, 0, r.saida);
  assert.match(r.saida, /Exercícios: 6 \(1 na biblioteca do Saraiva, 0 só no catálogo público, 5 sem par; 5 nomes diferentes sem par\)/);
  assert.match(r.saida, /2 nomes no arquivo \(2 por "sim", 0 por nome corrigido\); 1 exercícios ligados por eles \(já contados acima\) e 1 cujo destino não está/);
  assert.ok(!/Remada|Puxada|fictíci/.test(r.saida));
  // s, x e ok também são "sim"
  escrever([`Remada fictícia;1;${destino};0,9;s`, `Puxada fictícia;1;${destino};0,9;X`, `Exercício data;1;${destino};0,9;ok`]);
  assert.match((await rodarImportador(['--pasta', pasta, '--simular'], {})).saida, /3 nomes no arquivo \(3 por "sim", 0 por nome corrigido\); 3 exercícios ligados/);
  // o nome certo escrito vale pelo nome na biblioteca (sem acento nem caixa); o que não existe fica sem par e nunca vira exercício novo
  escreverComNomeCerto([`Remada fictícia;1;;;;${destino.toUpperCase()}`, 'Puxada fictícia;1;;;;Exercício que não existe', `Exercício data;1;${destino};0,9;sim;Outro nome`]);
  const c = await rodarImportador(['--pasta', pasta, '--simular'], {});
  assert.equal(c.status, 0, c.saida);
  // "sim" e nome certo na mesma linha (a 4 do arquivo): nenhum dos dois vale, o resumo conta e diz a linha
  assert.match(c.saida, /2 nomes no arquivo \(0 por "sim", 2 por nome corrigido\); 1 exercícios ligados por eles \(já contados acima\) e 1 cujo destino não está/);
  assert.match(c.saida, /Resposta em dúvida: 1 nomes no correspondencias-exercicios\.csv \(linhas 4\) têm "sim" e um nome certo ao mesmo tempo; nenhum dos dois foi usado\./);
  assert.ok(!/Remada|Puxada|fictíci|Outro nome/.test(c.saida));
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

// ------------------------------------------------- classificacao-suplementos.csv na linha de comando

test('converter-planos: grava classificacao-suplementos.csv (0600) só com o que nenhuma lista reconhece; regerar preserva o destino', (t) => {
  const pasta = pastaTemporaria(t, 'planos-classificacao-');
  const a = abas();
  a.Suplementos = [CAB_SUP,
    ['s1', 'P1', 'x', 'Creatina', '5 g', null, null], // lista comum
    ['s2', 'P1', 'x', 'Zincoxxx 10 mg', null, null, null],
    ['s3', 'P2', 'x', 'zincoxxx (lote 2)', null, null, null],
    ['s4', 'P2', 'x', 'Remédio Fictício XYZ', null, null, null],
  ];
  const arquivo = join(pasta, 'planilha.xlsx');
  writeFileSync(arquivo, xlsx(a));
  const saida = join(pasta, 'saida');
  const rodar = (...extra) => spawnSync(process.execPath, [CONVERSOR, '--planilha', arquivo, '--saida', saida, ...extra], { encoding: 'utf8' });

  const simulado = rodar('--simular');
  assert.equal(simulado.status, 0, simulado.stderr);
  assert.match(simulado.stdout, /Suplementos que nenhuma lista reconhece \(hoje na lista sensível\): 3 itens, 2 nomes diferentes; 0 linhas já com "destino" entendido no arquivo\./);
  assert.throws(() => readdirSync(saida));

  const primeira = rodar();
  assert.equal(primeira.status, 0, primeira.stderr);
  assert.ok(!/Zincoxxx|Rem[ée]dio/i.test(primeira.stdout + primeira.stderr));
  const caminho = join(saida, ARQUIVO_CLASSIFICACAO);
  const csv = readFileSync(caminho, 'utf8');
  assert.equal(csv, '﻿nome_normalizado;ocorrencias;destino\nzincoxxx;2;\nremedio ficticio xyz;1;\n');
  if (process.platform !== 'win32') assert.equal(statSync(caminho).mode & 0o077, 0);

  // o treinador preenche (em ANSI, como o Excel grava) e o conversor roda de novo
  writeFileSync(caminho, Buffer.from(csv.replace(/^﻿/, '').replace('zincoxxx;2;', 'zincoxxx;2;Suplemento '), 'latin1'));
  const segunda = rodar();
  assert.equal(segunda.status, 0, segunda.stderr);
  assert.match(segunda.stdout, /1 linhas já com "destino" entendido no arquivo\./);
  assert.deepEqual([...destinosClassificados(lerClassificacao(readFileSync(caminho, 'utf8')))], [['zincoxxx', 'suplemento']]);

  // destino que ninguém entende: a linha fica como está, o resumo conta e o problemas.csv aponta a linha do arquivo, sem repetir o valor
  const estranho = readFileSync(caminho, 'utf8').replace('remedio ficticio xyz;1;', 'remedio ficticio xyz;1;sei lá');
  writeFileSync(caminho, Buffer.from(estranho.replace(/^﻿/, ''), 'latin1'));
  const terceira = rodar();
  assert.equal(terceira.status, 0, terceira.stderr);
  assert.match(terceira.stdout, /1 linhas já com "destino" entendido no arquivo e 1 com destino não entendido/);
  assert.ok(!/sei l|Rem[ée]dio/i.test(terceira.stdout + terceira.stderr));
  const problemas = readFileSync(join(saida, 'problemas.csv'), 'utf8');
  assert.ok(problemas.includes(`${ARQUIVO_CLASSIFICACAO};3;destino não entendido`), problemas.slice(0, 300));
  assert.ok(!/sei l/.test(problemas));
  assert.match(readFileSync(caminho, 'utf8').replace(/\r/g, ''), /remedio ficticio xyz;1;sei lá/); // o arquivo da pessoa não é mexido

  writeFileSync(caminho, 'isto;nao;e;o;arquivo\n1;2;3;4;5\n');
  const quebrado = rodar();
  assert.equal(quebrado.status, 1);
  assert.match(quebrado.stderr, /não tem as colunas/);
});

/** Pasta de planos convertidos com as listas do repositório (as mesmas que o importador usa), com estes suplementos no plano P1 (AL1). */
function pastaDePlanosComSuplementos(t, nomes) {
  const pasta = pastaTemporaria(t, 'planos-importar-class-');
  const a = abas();
  a.Suplementos = [CAB_SUP, ...nomes.map((nome, i) => [`s${i}`, 'P1', 'x', nome, '1 dose', null, null])];
  const usados = new Set();
  for (const p of converterPlanos(lerXlsx(xlsx(a), { abas: ABAS_LIDAS }), HOJE, lerReferenciasDeSuplementos()).arquivos) {
    writeFileSync(join(pasta, nomeDoArquivo(p.codigo, usados)), JSON.stringify(p));
  }
  return pasta;
}

test('importar-planos --simular: usa só os destinos entendidos (suplemento ou sensível, em qualquer grafia) do classificacao-suplementos.csv da pasta', async (t) => {
  const pasta = pastaDePlanosComSuplementos(t, ['Creatina', 'Zincoxxx 10 mg', 'Remédio Fictício XYZ', 'Xilofone Fictício']);
  const arquivo = join(pasta, ARQUIVO_CLASSIFICACAO);
  const escrever = (...linhas) => writeFileSync(arquivo, `nome_normalizado;ocorrencias;destino\r\n${linhas.join('\r\n')}\r\n`);
  const simular = async () => (await rodarImportador(['--pasta', pasta, '--simular'], {})).saida;

  // sem o arquivo: tudo o que ninguém reconhece segue na sensível (comportamento de sempre)
  let saida = await simular();
  assert.match(saida, /medicação e ergogênicos: 3 itens/);
  assert.match(saida, /0 itens classificados como suplemento \(já levados para a Suplementação\), 0 como sensível, 3 não classificados/);
  // em branco: o mesmo, sem linha de "destino não entendido"
  escrever('zincoxxx;1;', 'remedio ficticio xyz;1;', 'xilofone ficticio;1;');
  saida = await simular();
  assert.match(saida, /medicação e ergogênicos: 3 itens/);
  assert.match(saida, /0 itens classificados como suplemento .*, 0 como sensível, 3 não classificados/);
  assert.ok(!/Destino não entendido/.test(saida));
  // destino que ninguém entende: o mesmo, mas conta e diz em que linhas do arquivo (a 1 é o cabeçalho)
  escrever('zincoxxx;1;', 'remedio ficticio xyz;1;talvez', 'xilofone ficticio;1;sei lá');
  saida = await simular();
  assert.match(saida, /medicação e ergogênicos: 3 itens/);
  assert.match(saida, /0 itens classificados como suplemento .*, 0 como sensível, 3 não classificados/);
  assert.match(saida, /Destino não entendido: 2 nomes no classificacao-suplementos\.csv \(linhas 3, 4\), 2 itens\. Escreva suplemento ou medicamento\./);
  // "Suplemento " (maiúscula e espaço) move; sensivel conta e fica
  escrever('zincoxxx;1; Suplemento ', 'remedio ficticio xyz;1;SENSIVEL', 'xilofone ficticio;1;');
  saida = await simular();
  assert.match(saida, /medicação e ergogênicos: 2 itens/);
  assert.match(saida, /1 itens classificados como suplemento .*, 1 como sensível, 1 não classificados/);
  // as outras formas de escrever: "s" move; "sensível" e "m" ficam como sensível
  escrever('zincoxxx;1;s', 'remedio ficticio xyz;1;sensível', 'xilofone ficticio;1;M');
  saida = await simular();
  assert.match(saida, /medicação e ergogênicos: 2 itens/);
  assert.match(saida, /1 itens classificados como suplemento .*, 2 como sensível, 0 não classificados/);
  assert.ok(!/Zincoxxx|Rem[ée]dio|Xilofone/i.test(saida));
  // arquivo que não é o de classificação: erro sem conteúdo
  writeFileSync(arquivo, 'a;b\n1;2\n');
  const ruim = await rodarImportador(['--pasta', pasta, '--simular'], {});
  assert.equal(ruim.status, 1);
  assert.match(ruim.saida, /Arquivo classificacao-suplementos\.csv: o classificacao-suplementos\.csv não tem as colunas/);
});

test('importar-planos --gravar: o item classificado como suplemento vai para a Suplementação; sem sobrar medicação, não exige ERGOGENICO_ALTERAR', async (t) => {
  const api = await apiFalsa({ permissoes: ['ALUNO_LER', 'PASTA_ALTERAR', 'BIBLIOTECA_LER', 'TREINO_ALTERAR', 'DIETA_ALTERAR'] });
  t.after(() => api.servidor.close());
  const pasta = pastaDePlanosComSuplementos(t, ['Creatina', 'Zincoxxx 10 mg']);
  const env = { API_URL: api.url, IMPORT_EMAIL: 'treinador@example.com', IMPORT_SENHA: 'senha-falsa' };

  // sem o arquivo sobra um item sensível e falta a permissão: para antes de gravar
  const sem = await rodarImportador(['--pasta', pasta, '--gravar'], env);
  assert.equal(sem.status, 1);
  assert.match(sem.saida, /Faltam permissões para este login: ERGOGENICO_ALTERAR/);

  writeFileSync(join(pasta, ARQUIVO_CLASSIFICACAO), 'nome_normalizado;ocorrencias;destino\nzincoxxx;1;suplemento\n');
  const r = await rodarImportador(['--pasta', pasta, '--gravar'], env);
  assert.equal(r.status, 0, r.saida);
  const dieta = [...api.rascunhos.values()].find((x) => x.tipo === 'dieta').corpo.conteudo;
  assert.deepEqual(dieta.suplementacao.map((x) => x.nome), ['Creatina', 'Zincoxxx 10 mg']);
  assert.equal(dieta.ergogenicos, null);
  assert.deepEqual(Object.keys(dieta.suplementacao[1]).sort(), ['dose', 'horario', 'link', 'nome', 'observacao', 'uid']);
  assert.ok(!/Zincoxxx|Creatina/.test(r.saida));
});

// ------------------------------------------------------------------------------------------ pacote para o Saraiva

test('conversão: cada problema leva o código do aluno dono da linha, e o resultado traz o nome de cada código', () => {
  const r = converter();
  const por = (aba, linha, trecho) => r.problemas.find((p) => p.aba === aba && p.linha === linha && p.tipo.includes(trecho));
  assert.equal(por('Treinos_Exercicios', 5, 'FS sem regra').codigo, 'AL1'); // exercício de rotina: o aluno da rotina
  assert.equal(por('Treinos_Rotinas', 3, 'rotina inativa').codigo, 'AL2');
  assert.equal(por('Planos', 4, 'mais de um plano ativo').codigo, 'AL4');
  assert.equal(por('Planos', 7, 'não está entre').codigo, 'AL9'); // aluno fora dos convertidos: o código da planilha
  assert.equal(por('Refeições', 8, 'item sem alimento').codigo, 'AL1'); // refeição: o aluno do plano
  assert.equal(por('Suplementos', 5, 'sem nome').codigo, 'AL1');
  assert.equal(por('Treinos_Exercicios', 8, 'não existe na aba').codigo, null); // rotina que não existe: sem dono
  assert.equal(r.nomes.get('AL1'), 'Aluno Um');
  assert.equal(r.nomes.get('AL5'), 'Aluno Cinco');
  assert.equal(r.nomes.get('AL9'), 'x'); // fora da aba Alunos: o "Nome Aluno" da própria linha
});

test('pacote: textoDoProblema escreve em português simples, sem código nem conteúdo da planilha, e conhece todos os tipos da conversão', () => {
  const t = (tipo) => textoDoProblema({ tipo, motivo: tipo });
  // os textos pedidos
  assert.match(t('FS sem regra de percentual na metodologia (séries sem carga)'), /série FS.*porcentagem/);
  assert.match(t('quantidade ausente, zero ou inválida (item mantido sem quantidade)'), /falta a quantidade/);
  assert.match(t('aluno do plano não está entre os alunos convertidos'), /aluno que não está na aba Alunos/);
  assert.match(t('aluno do rotina não está entre os alunos convertidos'), /treino é de um aluno/);
  assert.match(t('mais de um plano ativo para o aluno (nenhum usado)'), /mais de um plano marcado como ativo/);
  assert.match(t('plano inativo (ignorado)'), /inativo.*não vai ser importado/);
  assert.match(t('rotina inativa (ignorada)'), /treino está marcado como inativo/);
  assert.match(t('item sem alimento (ignorado)'), /falta o nome do alimento/);
  assert.equal(t('nome do exercício com mais de 120 letras (cortado)'), 'o nome passa de 120 letras; encurte');
  assert.equal(t('nome do alimento com mais de 160 letras (cortado)'), 'o nome passa de 160 letras; encurte');
  assert.equal(t('observação com mais de 1000 letras (cortado)'), 'o texto passa de 1000 letras; encurte');
  assert.match(t('quantidade de WS acima de 10 (ignorada)'), /mais de 10 séries WS/);
  assert.equal(t('destino não entendido'), 'o destino não foi entendido; escreva suplemento ou medicamento');
  assert.match(t('resposta em dúvida'), /"sim" e um nome em "Se não, qual é" ao mesmo tempo/);
  // um tipo que a tabela não conhece vira um texto genérico com o motivo
  assert.equal(textoDoProblema({ tipo: 'coisa nova', motivo: 'coisa nova' }), 'confira esta linha (coisa nova)');
  // todos os tipos que a conversão de fato produz têm texto próprio (nenhum cai no genérico), sem o código do aluno
  for (const p of converter().problemas) {
    const texto = textoDoProblema(p);
    assert.ok(!texto.startsWith('confira esta linha'), `${p.tipo} -> ${texto}`);
    assert.ok(!/\bAL\d|\bnull\b|undefined/.test(texto), texto);
  }
});

test('pacote: 3-o-que-corrigir.csv tem BOM, ; e o cabeçalho do Saraiva; vem por aluno, aba e linha; sem dono, o traço', () => {
  const r = converter();
  const { csv, total } = csvDoQueCorrigir(r.problemas, r.nomes);
  assert.equal(total, r.problemas.length);
  const lido = lerCsv(csv); // textos com ";" saem entre aspas, como o Excel espera
  assert.ok(csv.startsWith('﻿Aluno;Aba;Linha;O que corrigir\n'));
  assert.deepEqual(lido.colunas, ['aluno', 'aba', 'linha', 'o_que_corrigir']);
  assert.equal(lido.linhas.length, r.problemas.length);
  assert.ok(lido.linhas.every((l) => l.o_que_corrigir.length > 0));
  // ordem: aluno, depois aba e linha; o problema sem dono mostra só o traço
  const alunos = lido.linhas.map((l) => l.aluno);
  const comNome = alunos.filter((a) => a !== '—');
  assert.deepEqual(comNome, [...comNome].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  assert.ok(alunos.includes('—'));
  assert.deepEqual(lido.linhas.filter((l) => l.aluno === 'Aluno Quatro').map((l) => [l.aba, l.linha]), [['Planos', '4'], ['Planos', '5']]);
  assert.ok(!/AL[12456]\b/.test(csv)); // o nome do aluno, nunca o código, quando se sabe
  // código sem nome conhecido: aparece como está na planilha
  assert.ok(csvDoQueCorrigir(r.problemas, new Map()).csv.includes('AL4;Planos;4;'));
  // problema de arquivo de decisão (sem aluno) entra com o traço e a linha do arquivo
  const solto = csvDoQueCorrigir([{ aba: ARQUIVO_CLASSIFICACAO, linha: 3, tipo: 'destino não entendido', motivo: 'destino não entendido', codigo: null }], r.nomes).csv;
  assert.equal(solto, `﻿Aluno;Aba;Linha;O que corrigir\n—;${ARQUIVO_CLASSIFICACAO};3;"o destino não foi entendido; escreva suplemento ou medicamento"\n`);
});

test('pacote: 1-suplementos.csv e 2-exercicios.csv têm BOM, ; , só o que falta decidir, do mais frequente para o menos, e "—" sem sugestão', () => {
  const sup = linhasDeClassificacao(planosComSuplementos(ITENS_DE_CLASSIFICACAO), REFS, lerClassificacao('nome_normalizado;ocorrencias;destino\nsumiu da planilha;4;sensivel\n'));
  const s = csvDeSuplementosParaConferir(sup.linhas);
  // o nome que sumiu da planilha (0 ocorrências hoje) não vai para o Saraiva
  assert.equal(s.csv, '﻿Nome na planilha;Quantas vezes aparece;Destino\nxilofone ficticio;2;\nzincoxxx;1;\n');
  assert.equal(s.total, 2);

  const pares = paresFicticios();
  const { linhas } = linhasDeCorrespondencia([
    arquivoComExercicios('Remada curvadda', 'Remada curvadda', 'Puxada altta polia', 'Xyzzy qwerty', 'Supino reto com barra', 'Agachamento livre'),
  ], pares);
  const e = csvDeExerciciosParaConferir(linhas);
  assert.equal(e.total, 3); // só os sem par exato
  assert.equal(e.semSugestao, 1);
  assert.equal(e.csv, [
    '﻿Nome na planilha;Quantas vezes aparece;Sugestão do app;Está certo?;Se não, qual é',
    'Remada curvadda;2;Remada curvada;;',
    'Puxada altta polia;1;Puxada alta na polia;;',
    `Xyzzy qwerty;1;${SEM_SUGESTAO};;`,
    '',
  ].join('\n'));
  // o que o Saraiva devolve é lido direto pelo importador: "—" não é sugestão
  const devolvido = e.csv.replace('Remada curvadda;2;Remada curvada;;', 'Remada curvadda;2;Remada curvada;sim;').replace(`Xyzzy qwerty;1;${SEM_SUGESTAO};;`, `Xyzzy qwerty;1;${SEM_SUGESTAO};;Rosca direta`);
  assert.deepEqual([...vinculosConfirmados(lerCorrespondencias(devolvido))].sort(), [
    [chaveDoExercicio('Remada curvadda'), chaveDoExercicio('Remada curvada')],
    [chaveDoExercicio('Xyzzy qwerty'), chaveDoExercicio('Rosca direta')],
  ].sort());
});

test('pacote: a mensagem do Gustavo leva só as contagens', () => {
  const m = textoDaMensagem({ suplementos: 27, exercicios: 254, problemas: 62 });
  assert.match(m, /\*Suplementos\* \(27 nomes\)/);
  assert.match(m, /\*Exercícios\* \(254 nomes que o app não achou na biblioteca\)/);
  assert.match(m, /\*O que corrigir\* \(62 linhas\)/);
  assert.match(m, /_suplemento_ ou _medicamento_/);
  assert.match(m, /rascunho/);
});

test('converter-planos --pacote: grava a pasta para-o-saraiva com os 4 arquivos; com --simular só conta; sem --pacote não cria nada', (t) => {
  const pasta = pastaTemporaria(t, 'planos-pacote-');
  const arquivo = join(pasta, 'planilha.xlsx');
  writeFileSync(arquivo, planilhaFicticia());
  const saida = join(pasta, 'saida');
  const rodar = (...extra) => spawnSync(process.execPath, [CONVERSOR, '--planilha', arquivo, '--saida', saida, ...extra], { encoding: 'utf8' });

  const simulado = rodar('--simular', '--pacote');
  assert.equal(simulado.status, 0, simulado.stderr);
  assert.match(simulado.stdout, /Pacote do Saraiva: \d+ suplementos, 6 exercícios \(\d+ sem sugestão\) e 16 linhas a corrigir \(nada gravado\)\./);
  assert.throws(() => readdirSync(saida));

  const sem = rodar();
  assert.equal(sem.status, 0, sem.stderr);
  assert.throws(() => readdirSync(join(saida, PASTA_DO_PACOTE)));
  assert.ok(!/Pacote do Saraiva/.test(sem.stdout));

  const com = rodar('--pacote');
  assert.equal(com.status, 0, com.stderr);
  assert.match(com.stdout, /Pacote do Saraiva: .*em para-o-saraiva\/ \(1-suplementos\.csv, 2-exercicios\.csv, 3-o-que-corrigir\.csv e mensagem\.txt\): mande por canal privado, nunca em grupo/);
  assert.ok(!/Aluno (Um|Dois|Quatro|Cinco|Seis)|Remada|Puxada|Xilofone|Rem[ée]dio/i.test(com.stdout + com.stderr)); // o terminal só conta
  const dentro = join(saida, PASTA_DO_PACOTE);
  assert.deepEqual(readdirSync(dentro).sort(), [...ARQUIVOS_DO_PACOTE].sort());
  for (const nome of ARQUIVOS_DO_PACOTE.filter((n) => n.endsWith('.csv'))) assert.ok(readFileSync(join(dentro, nome), 'utf8').startsWith('﻿'), nome);
  if (process.platform !== 'win32') for (const nome of ARQUIVOS_DO_PACOTE) assert.equal(statSync(join(dentro, nome)).mode & 0o077, 0, nome);
  const corrigir = readFileSync(join(dentro, '3-o-que-corrigir.csv'), 'utf8');
  assert.equal(corrigir.trimEnd().split('\n').length, 1 + 16);
  assert.ok(corrigir.includes('Aluno Um;Treinos_Exercicios;5;'));
  const exercicios = readFileSync(join(dentro, '2-exercicios.csv'), 'utf8');
  assert.equal(exercicios.trimEnd().split('\n').length, 1 + 6);
  assert.match(readFileSync(join(dentro, 'mensagem.txt'), 'utf8'), /\*O que corrigir\* \(16 linhas\)/);

  // o destino que a pessoa escreveu e ninguém entende entra no "o que corrigir" desta rodada
  const a = abas();
  a.Suplementos = [CAB_SUP, ['s1', 'P1', 'x', 'Zincoxxx 10 mg', null, null, null]];
  writeFileSync(arquivo, xlsx(a));
  writeFileSync(join(saida, ARQUIVO_CLASSIFICACAO), 'nome_normalizado;ocorrencias;destino\nzincoxxx;1;sei lá\n');
  const de_novo = rodar('--pacote');
  assert.equal(de_novo.status, 0, de_novo.stderr);
  assert.ok(readFileSync(join(dentro, '3-o-que-corrigir.csv'), 'utf8').includes(`—;${ARQUIVO_CLASSIFICACAO};2;"o destino não foi entendido; escreva suplemento ou medicamento"`));
});
