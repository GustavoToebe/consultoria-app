#!/usr/bin/env node
/**
 * Cria, pela API e como treinador do Saraiva, o conteúdo da demonstração: 5 metodologias, as semanas de treino
 * (Full Body, AB, ABC, ABCDE e PPL 1 a 5), 6 dias avulsos, 10 dietas, 4 refeições, 3 pacotes e 10 mobilidades.
 * Tudo vai para a coleção "Biblioteca do guia", separada do resto do conteúdo do Saraiva. Só dados fictícios de
 * demonstração; nada disto entra em consultoria nova.
 *
 *   node scripts/demo/popular-modelos.mjs --simular     (só lê; mostra o que faria)
 *   node scripts/demo/popular-modelos.mjs               (grava)
 *   node scripts/demo/popular-modelos.mjs --substituir  (também troca o conteúdo de modelos que já existem)
 *
 * Pode rodar de novo à vontade: só cria o que ainda não existe (pelo nome, em cada tipo). Exercício que já está na
 * biblioteca é reaproveitado (mesma função `chave()` do importar.mjs); o que não está é criado SEM vídeo. Alimento é
 * ligado ao catálogo TACO pela busca; sem correspondência, o item fica só com nome e quantidade. Nenhum valor
 * nutricional é digitado: os números do item vêm sempre do alimento da biblioteca, como o editor faz.
 *
 * Variáveis: API_URL (padrão http://localhost:8088/api), DEMO_EMAIL (padrão saraiva@demo.local) e DEMO_SENHA.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chave, grupoDe, modalidadeDe } from '../importacao/importar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SIMULAR = process.argv.includes('--simular');
const SUBSTITUIR = process.argv.includes('--substituir');
const BASE = process.env.API_URL ?? 'http://localhost:8088/api';
const COLECAO = 'Biblioteca do guia';
const lerJson = (nome) => JSON.parse(readFileSync(join(AQUI, 'dados', nome), 'utf8'));
const falar = (...a) => console.log(...a);

// ---------------------------------------------------------------- API
let token = null;
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'X-Treinos-Cliente': 'nativo', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}
async function entrar() {
  const senha = process.env.DEMO_SENHA;
  if (!senha) throw new Error('Defina DEMO_SENHA no ambiente.');
  const j = await chamar('POST', '/auth/login', { email: process.env.DEMO_EMAIL ?? 'saraiva@demo.local', senha });
  token = j.accessToken ?? j.token ?? j.access_token;
  if (!token) throw new Error('Login sem token de acesso.');
}

const rel = { exerciciosCriados: [], exerciciosDaBiblioteca: new Set(), alimentos: [], modelos: [] };

// ---------------------------------------------------------------- exercícios
const biblioteca = new Map(); // chave -> exercício
let seq = 0;

const ALIAS = Object.fromEntries(Object.entries(lerJson('aliases.json').aliases).map(([de, para]) => [chave(de), para]));

async function exercicio(nome) {
  const k = chave(ALIAS[chave(nome)] ?? nome);
  let e = biblioteca.get(k);
  if (e) { rel.exerciciosDaBiblioteca.add(e.nome); return e; }
  const corpo = { nome, grupoMuscular: grupoDe(nome), equipamento: null, modalidade: modalidadeDe(nome), videoUrl: null, observacoes: null };
  e = SIMULAR ? { id: `sim-${++seq}`, ...corpo } : await chamar('POST', '/exercicios', corpo);
  biblioteca.set(k, e);
  rel.exerciciosCriados.push(nome);
  return e;
}

/** Composto pesado (agachamento, terra, supino, remada): 4 séries de 6 a 10; os demais, 3 séries de 8 a 12. */
const PESADO = /^(agachamento livre|levantamento terra|supino reto|remada curvada)\b/;
function series(nome) {
  const pesado = PESADO.test(chave(nome));
  return Array.from({ length: pesado ? 4 : 3 }, () => ({
    uid: randomUUID(), tipo: 'WS', repsMin: pesado ? 6 : 8, repsMax: pesado ? 10 : 12, tecnica: null,
    descansoSegundos: pesado ? 90 : 75, intensidade: { modo: 'CARGA_TRABALHO' },
  }));
}

async function sessao(nome, dia, diaSemana) {
  const exercicios = [];
  for (const x of dia.ex) {
    const e = await exercicio(x);
    exercicios.push({
      uid: randomUUID(), exercicioId: String(e.id).startsWith('sim-') ? null : e.id, nome: e.nome, modalidade: e.modalidade,
      videoUrl: e.videoUrl ?? null, observacao: null, progressao: true, unidade: 'kg', series: series(x),
    });
  }
  return { uid: randomUUID(), nome, diaSemana, tipo: 'TREINO', frequenciaSemanal: null, observacao: dia.obs, cardio: null, exercicios };
}

const descanso = (diaSemana) => ({ uid: randomUUID(), nome: 'Descanso', diaSemana, tipo: 'DESCANSO', frequenciaSemanal: null, observacao: null, cardio: null, exercicios: [] });

// ---------------------------------------------------------------- alimentos
const alimentos = new Map(); // chave do nome -> alimento da biblioteca da consultoria

async function carregarAlimentos() {
  alimentos.clear();
  for (const a of await chamar('GET', '/alimentos')) alimentos.set(chave(a.nome), a);
}

/** Alimento da biblioteca para um candidato ({biblioteca} ou {taco}); importa do TACO quando preciso. */
async function resolver(candidato) {
  if (candidato.biblioteca) return alimentos.get(chave(candidato.biblioteca)) ?? null;
  const ja = alimentos.get(chave(candidato.taco));
  if (ja) return ja;
  const achados = await chamar('GET', `/catalogo/alimentos?limite=50&busca=${encodeURIComponent(candidato.taco)}`);
  const c = achados.itens.find((i) => chave(i.nome) === chave(candidato.taco));
  if (!c) return null;
  if (SIMULAR) { rel.alimentos.push(`${c.nome}: seria importado do TACO`); return { ...c, gramasPorUnidade: null }; }
  await chamar('POST', '/alimentos/importar-catalogo', { ids: [c.id] });
  await carregarAlimentos();
  rel.alimentos.push(`${c.nome}: importado do TACO`);
  return alimentos.get(chave(candidato.taco)) ?? null;
}

const arredondar = (n) => Math.round(n * 1000) / 1000;
/** Mesma conta do editor (dominio/dieta.ts): o valor do item vem do alimento, nunca é digitado. */
function item(termo, alimento, quantidade) {
  const unidade = termo.unidade ?? 'g';
  const base = !alimento ? null
    : unidade === alimento.baseUnidade ? quantidade
      : unidade === 'un' && alimento.baseUnidade === 'g' && alimento.gramasPorUnidade ? quantidade * alimento.gramasPorUnidade
        : unidade === 'g' && alimento.baseUnidade === 'un' && alimento.gramasPorUnidade ? quantidade / alimento.gramasPorUnidade : null;
  const fator = base === null ? null : base / alimento.baseQuantidade;
  const valor = (v) => (fator === null || v === undefined ? null : arredondar(v * fator));
  return {
    uid: randomUUID(), alimentoId: alimento && !SIMULAR ? alimento.id : null, nome: alimento ? alimento.nome : termo.nome,
    quantidade, unidade,
    kcal: alimento ? valor(alimento.kcal) : null, proteina: alimento ? valor(alimento.proteina) : null,
    carboidrato: alimento ? valor(alimento.carboidrato) : null, gordura: alimento ? valor(alimento.gordura) : null,
    manual: false,
  };
}

async function montarDietas() {
  const d = lerJson('dietas.json');
  const resolvidos = {};
  for (const [chaveTermo, termo] of Object.entries(d.alimentos)) {
    let achado = null;
    for (const c of termo.candidatos) { achado = await resolver(c); if (achado) break; }
    resolvidos[chaveTermo] = achado;
    if (!achado) rel.alimentos.push(`${termo.nome}: sem alimento do catálogo (fica só nome e quantidade)`);
  }
  const itens = (lista) => lista.map(([t, q]) => item(d.alimentos[t], resolvidos[t], q));
  const refeicao = (nome, lista) => ({ uid: randomUUID(), nome, horario: null, observacao: null, opcoes: [{ uid: randomUUID(), rotulo: 'A', itens: itens(lista) }] });
  const conteudo = (refeicoes, observacoes) => ({ objetivo: null, dataInicio: null, profissional: null, refeicoes, orientacoes: [], observacoes, suplementacao: [] });
  const cafe = (x) => [[x.cafeSemPao ?? 'pao', 50], ['ovo', 3], ['chia', 5], [x.fruta, 100], ['iogurte', 150], ['aveia', 30]];
  const dietas = d.dietas.map((x) => ({
    nome: x.nome, descricao: 'Quatro refeições: café, almoço, lanche e jantar.',
    montar: () => conteudo([refeicao('Café', cafe(x)), refeicao('Almoço', x.almoco), refeicao('Lanche', x.lanche), refeicao('Jantar', x.jantar)], d.observacaoDaDieta),
  }));
  const refeicoes = d.refeicoes.map((r) => {
    const x = d.dietas[r.dieta];
    const lista = { Café: cafe(x), Almoço: x.almoco, Lanche: x.lanche, Jantar: x.jantar }[r.refeicao];
    return { nome: r.nome, descricao: `Refeição pronta: ${r.refeicao.toLowerCase()}.`, montar: () => conteudo([refeicao(r.refeicao, lista)], null) };
  });
  return { dietas, refeicoes, pacotes: d.pacotes };
}

// ---------------------------------------------------------------- gravação
let colecaoId = null;
async function garantirColecao() {
  const lista = await chamar('GET', '/pastas-modelos');
  const ja = lista.find((p) => p.nome === COLECAO);
  if (ja) { colecaoId = ja.id; return; }
  if (SIMULAR) { rel.modelos.push(`coleção "${COLECAO}": seria criada`); return; }
  colecaoId = (await chamar('POST', '/pastas-modelos', { nome: COLECAO })).id;
  rel.modelos.push(`coleção "${COLECAO}": criada`);
}

const existentes = {};
async function gravar(tipo, nome, descricao, conteudo) {
  existentes[tipo] ??= await chamar('GET', `/receitas?tipo=${tipo}`);
  const ja = existentes[tipo].find((r) => r.nome === nome);
  const rotulo = `${tipo} · ${nome}`;
  if (ja && !SUBSTITUIR) { rel.modelos.push(`${rotulo}: já existe, mantido`); return; }
  if (SIMULAR) { rel.modelos.push(`${rotulo}: ${ja ? 'seria substituído' : 'seria criado'}`); return; }
  if (ja) { await chamar('PUT', `/receitas/${ja.id}`, { ...ja, descricao, conteudo }); rel.modelos.push(`${rotulo}: conteúdo substituído`); }
  else { await chamar('POST', '/receitas', { tipo, nome, descricao, conteudo, pastaId: colecaoId }); rel.modelos.push(`${rotulo}: criado`); }
}

// ---------------------------------------------------------------- principal
async function principal() {
  await entrar();
  falar(SIMULAR ? 'SIMULAÇÃO: nada será gravado.' : 'Gravando na API', BASE);
  for (const e of await chamar('GET', '/exercicios')) biblioteca.set(chave(e.nome), e);
  falar(`Biblioteca de exercícios: ${biblioteca.size}.`);
  await carregarAlimentos();
  await garantirColecao();

  for (const m of lerJson('metodologias.json').metodologias) await gravar('METODOLOGIA', m.nome, m.descricao, m.configuracao);

  const treinos = lerJson('treinos.json');
  const conteudosDeSemana = new Map();
  for (const s of treinos.semanas) {
    const sessoes = [];
    for (const [i, nomeDoDia] of s.dias.entries()) sessoes.push(await sessao(nomeDoDia, treinos.dias[nomeDoDia], i + 1));
    for (let dia = s.dias.length + 1; dia <= 7; dia++) sessoes.push(descanso(dia));
    const conteudo = { objetivo: null, orientacoes: null, sessoes };
    conteudosDeSemana.set(s.nome, conteudo);
    await gravar('PLANO_TREINO', s.nome, s.descricao, conteudo);
  }
  for (const nomeDoDia of treinos.avulsos) {
    const dia = treinos.dias[nomeDoDia];
    const conteudo = { objetivo: null, orientacoes: null, sessoes: [await sessao(nomeDoDia, dia, null)] };
    await gravar('SESSAO_TREINO', nomeDoDia, `Treino avulso: ${dia.obs.toLowerCase()}.`, conteudo);
  }

  const { dietas, refeicoes, pacotes } = await montarDietas();
  const conteudosDeDieta = new Map();
  for (const x of dietas) { const c = x.montar(); conteudosDeDieta.set(x.nome, c); await gravar('PLANO_DIETA', x.nome, x.descricao, c); }
  for (const x of refeicoes) await gravar('REFEICAO', x.nome, x.descricao, x.montar());

  for (const p of pacotes) {
    const treino = conteudosDeSemana.get(p.semana); const dieta = conteudosDeDieta.get(p.dieta);
    if (!treino || !dieta) throw new Error(`Pacote "${p.nome}" aponta para modelo que não existe.`);
    await gravar('PASTA_PLANO', p.nome, `${p.semana} com a dieta ${p.dieta}.`, {
      planos: [{ titulo: p.semana, treino, dieta: null, mobilidade: null }, { titulo: p.dieta, treino: null, dieta, mobilidade: null }],
    });
  }

  for (const m of lerJson('mobilidades.json').mobilidades) {
    const conteudo = {
      orientacoes: m.orientacoes ?? null,
      secoes: [{ uid: randomUUID(), titulo: m.nome, itens: m.itens.map(([nome, prescricao]) => ({ uid: randomUUID(), nome, prescricao: prescricao ?? null, videoUrl: null })) }],
    };
    await gravar('MOBILIDADE', m.nome, m.descricao, conteudo);
  }

  const lista = (titulo, itens) => { if (itens.length) { falar(`\n${titulo} (${itens.length}):`); itens.forEach((i) => falar(`  - ${i}`)); } };
  falar(`\nExercícios reaproveitados da biblioteca: ${rel.exerciciosDaBiblioteca.size}. Exercícios novos (sem vídeo): ${rel.exerciciosCriados.length}.`);
  lista('Exercícios criados', rel.exerciciosCriados);
  lista('Alimentos', rel.alimentos);
  lista('Modelos', rel.modelos);
}

if (process.argv[1].endsWith('popular-modelos.mjs')) {
  principal().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
}
