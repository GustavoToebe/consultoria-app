#!/usr/bin/env node
/**
 * Importa para a consultoria do Saraiva (pela API, como treinador) os vídeos da biblioteca de exercícios, os modelos
 * de semana de treino, os modelos de mobilidade, os suplementos e a lista de medicação e ergogênicos que estão em ./dados. Pode rodar de novo à vontade: só cria o que
 * ainda não existe e nunca troca um vídeo que já está na biblioteca. Série "Rest pause" do PDF vira WS com o alvo
 * "Rest pause" (a técnica é completada no editor; o resumo conta quantas).
 *
 *   node scripts/importacao/importar.mjs --simular     (só lê; mostra o que faria)
 *   node scripts/importacao/importar.mjs               (grava)
 *   node scripts/importacao/importar.mjs --substituir  (também troca o conteúdo de modelos que já existem)
 *   node scripts/importacao/importar.mjs --trocar-videos  (troca o vídeo de exercício que já tinha outro; a lista de vídeos vale mais que os planos)
 *   node scripts/importacao/importar.mjs --simular --ver "Plano 10"  (mostra o conteúdo que seria gravado do modelo)
 *
 * Variáveis: API_URL (padrão http://localhost:8088/api), IMPORT_EMAIL (padrão saraiva@demo.local) e a senha em
 * IMPORT_SENHA ou DEMO_SENHA. Dados só de treino (nada de aluno).
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SIMULAR = process.argv.includes('--simular');
const SUBSTITUIR = process.argv.includes('--substituir');
const TROCAR_VIDEOS = process.argv.includes('--trocar-videos');
const VER = process.argv.includes('--ver') ? process.argv[process.argv.indexOf('--ver') + 1] : null;
const BASE = process.env.API_URL ?? 'http://localhost:8088/api';
const lerJson = (nome) => JSON.parse(readFileSync(join(AQUI, 'dados', nome), 'utf8'));

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
  const senha = process.env.IMPORT_SENHA ?? process.env.DEMO_SENHA;
  if (!senha) throw new Error('Defina IMPORT_SENHA (ou DEMO_SENHA) no ambiente.');
  const j = await chamar('POST', '/auth/login', { email: process.env.IMPORT_EMAIL ?? 'saraiva@demo.local', senha });
  token = j.accessToken ?? j.token ?? j.access_token;
  if (!token) throw new Error('Login sem token de acesso.');
}

// ---------------------------------------------------------------- nomes, links e classificação
const PARADA = new Set(['a', 'o', 'as', 'os', 'na', 'no', 'nas', 'nos', 'de', 'da', 'do', 'com', 'em', 'para', 'e', 'ou']);
/** Chave de comparação: sem acento, caixa, pontuação e artigos ("Supino inclinado máquina" = "Supino inclinado na máquina"). */
export function chave(nome) {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/c\//g, 'com ')
    .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((p) => p && !PARADA.has(p)).join(' ');
}

/** Exercícios do plano que são o mesmo da lista de vídeos, só escritos de outro jeito (nome do plano -> nome da biblioteca). */
const ALIAS_NOME = {
  'Remada articulada unilateral': 'Remada na máquina articulada unilateral',
  'Agachamento livre ou no smith': 'Agachamento livre',
  'Agachamento búlgaro c/ 1 halter': 'Agachamento búlgaro',
  'Elevação pélvica no smith, na máquina ou livre': 'Elevação pélvica',
  'Elevação lateral com halteres sentada no banco em 90º': 'Elevação lateral sentado no banco 90º',
  'Elevação lateral com halter sentado no banco em 90º': 'Elevação lateral sentado no banco 90º',
  'Remada baixa na polia com barra reta': 'Remada baixa na polia com pegada pronada na barra reta',
  'Peck deck': 'Peck Deck (crossover máquina)',
  'Remada curvada com barra livre': 'Remada curvada',
  'Remada na polia baixa c/ barra reta (pronada)': 'Remada baixa na polia com pegada pronada na barra reta',
  'Supino reto com barra livre': 'Supino reto com barra',
  'Supino inclinado com halteres (30°)': 'Supino inclinado com halter',
  'Remada unilateral na máquina (neutra)': 'Remada na máquina articulada unilateral',
  'Puxada alta com pegada neutra': 'Puxada alta na polia com pegada neutra ou triângulo',
  'Elevação lateral na polia baixa': 'Elevação lateral na polia',
  'Tríceps na polia alta com corda': 'Tríceps com corda na polia',
};
export const ALIAS = Object.fromEntries(Object.entries(ALIAS_NOME).map(([de, para]) => [chave(de), para]));

/** Parecidos o bastante para serem o mesmo exercício (mesmas palavras, uma lista dentro da outra). */
function parecidos(a, b) {
  const x = new Set(a.split(' ')); const y = new Set(b.split(' '));
  const inter = [...x].filter((t) => y.has(t)).length;
  return inter / Math.min(x.size, y.size) >= 0.75;
}

export function idDoVideo(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
    return u.searchParams.get('v');
  } catch { return null; }
}
/** Mantém só o que identifica o vídeo (tira playlist, índice, `si`, `feature`). */
export function urlLimpa(url) {
  if (!url) return null;
  const id = idDoVideo(url);
  if (!id) return null;
  const u = new URL(url);
  if (u.hostname === 'youtu.be') return `https://youtu.be/${id}`;
  if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/shorts/${id}`;
  const t = u.searchParams.get('t');
  return `https://www.youtube.com/watch?v=${id}${t ? `&t=${t}` : ''}`;
}

/** Grupo muscular com os nomes do catálogo. `secao` é a seção do PDF de vídeos (vale para Costas, Peito e Ombros). */
export function grupoDe(nome, secao = null) {
  const n = chave(nome);
  if (secao === 'Costas') return 'Costas';
  if (secao === 'Peito') return 'Peito';
  if (secao === 'Ombros') return 'Ombros';
  if (/panturrilha|gemeos/.test(n)) return 'Panturrilha';
  if (/abducao|abdutora/.test(n)) return 'Abdutores';
  if (/aducao|adutora/.test(n)) return 'Adutores';
  if (/triceps/.test(n)) return 'Tríceps';
  if (/biceps|rosca|scott|martelo|spider/.test(n)) return 'Bíceps';
  if (/elevacao pelvica|coice|extensao quadril|clamshell|hip thrust/.test(n)) return 'Glúteos';
  if (/desenvolvimento|elevacao (lateral|frontal)|military|face pull|crucifixo invertido|remada alta/.test(n)) return 'Ombros';
  if (/^abs |abdominal|prancha|russian|bird dog|stir the pot/.test(n)) return 'Abdômen';
  if (/agachamento|leg press|extensora|afundo|passada|avanco|hack squat|step up/.test(n)) return 'Quadríceps';
  if (/flexora|stiff|rdl|sldl|^terra|bom dia/.test(n)) return 'Posterior';
  if (/supino|crossover|crucifixo|peck deck/.test(n)) return 'Peito';
  if (/remada|puxada|pulldown|t bar|pendlay|pullover|chinese row|retracao escapular|high row|hiperextensao/.test(n)) return 'Costas';
  return null;
}

export function modalidadeDe(nome) {
  const n = chave(nome);
  if (/\bband\b|elastico/.test(n)) return 'ELASTICO';
  if (/prancha|paralela(?! maquina)|spinal rock|bird dog|stir the pot|^abs (no ghd|infra|no banco)|hiperextensao banco romano$/.test(n)) return 'PESO_CORPORAL';
  if (/maquina|polia|smith|cadeira|puxada|panturrilha|mesa flexora|pulldown|leg press|hack|peck deck|crossover|scott maquina|articulada|extensora|flexora|high row|chinese row|abducao|step up/.test(n)) return 'MAQUINA';
  if (/barra|halter|livre|agachamento|terra|stiff|rdl|sldl|afundo|passada|avanco|rosca|martelo|elevacao|crucifixo|supino|remada|pullover|military|bom dia|abs|pendlay|t bar|meadows|francesa|francês|spider|giro/.test(n)) return 'LIVRE';
  return 'OUTRO';
}

// ---------------------------------------------------------------- séries
// "Rest pause" fica aqui só para o PDF ser lido: não é tipo de série, é técnica (`montarSeries` converte).
const TIPOS = { aquecimento: 'Aquecimento', fs: 'FS', ws: 'WS', 'back off': 'Back off', 'top set': 'Top set', 'rest pause': 'Rest pause' };
const REGRA_PADRAO = { 1: [85], 2: [70, 85], 3: [50, 70, 85] };

/** Texto do PDF ("2x3 a 5 - FS", "1x6-8 – WS", "1x5-10 (Aquecimento)") em itens {n, min, max, tipo}. */
export function lerSeries(linhas) {
  const itens = [];
  const ER = /^(\d+)\s*x\s*(\d+)(?:\s*(?:a|-|–)\s*(\d+))?\s*[-–]?\s*\(?\s*([A-Za-zÀ-ú ]*?)\s*\)?\s*$/;
  for (const bruta of linhas) {
    if (typeof bruta !== 'string') { itens.push(bruta); continue; }
    const linha = bruta.trim();
    const m = ER.exec(linha);
    if (m) {
      itens.push({ n: +m[1], min: +m[2], max: m[3] ? +m[3] : +m[2], tipo: m[4] ? TIPOS[m[4].toLowerCase()] ?? null : null, original: linha });
    } else if (TIPOS[linha.toLowerCase()] && itens.length && !itens[itens.length - 1].tipo) {
      itens[itens.length - 1].tipo = TIPOS[linha.toLowerCase()];
    } else {
      throw new Error(`Série não reconhecida: "${linha}"`);
    }
  }
  for (const i of itens) if (!i.tipo && !i.alvoTexto) throw new Error(`Série sem tipo: "${i.original}"`);
  return itens;
}

const percentual = (obs, re) => { const m = re.exec(obs); return m ? Number(m[1]) : null; };

/**
 * Séries do exercício no formato da API (uma por série), com % da WS lidos da observação. "1x8-12 Rest pause" vira WS
 * com o alvo "Rest pause" e sem técnica: o PDF não traz pausa nem retomadas, e nada é inventado (o treinador completa).
 */
export function montarSeries(linhas, obs, regra) {
  const itens = lerSeries(linhas);
  const totalFs = itens.filter((i) => i.tipo === 'FS').reduce((t, i) => t + i.n, 0);
  const pBack = percentual(obs, /back off[^%\d]*?(\d+)\s*%/i);
  const pTop = percentual(obs, /top set[^%\d+]*\+\s*(\d+)\s*%/i);
  const faixa = regra[totalFs] ?? null;
  let fs = 0;
  const series = [];
  for (const i of itens) {
    for (let k = 0; k < i.n; k++) {
      const serie = { uid: randomUUID(), tipo: i.tipo, repsMin: i.min ?? null, repsMax: i.max ?? null, alvoTexto: i.alvoTexto ?? null, descansoSegundos: null };
      let inten = { modo: 'NENHUMA' };
      if (i.tipo === 'Rest pause') { serie.tipo = 'WS'; serie.alvoTexto = 'Rest pause'; inten = { modo: 'CARGA_TRABALHO' }; rel.restPause++; }
      else if (i.tipo === 'FS' && faixa) inten = { modo: 'PERCENTUAL_WS', percentual: faixa[fs++] };
      else if (i.tipo === 'FS') fs++;
      else if (i.tipo === 'WS') inten = { modo: 'CARGA_TRABALHO' };
      else if (i.tipo === 'Back off' && pBack) inten = { modo: 'PERCENTUAL_WS', percentual: pBack };
      else if (i.tipo === 'Top set') inten = pTop ? { modo: 'PERCENTUAL_WS', percentual: 100 + pTop } : { modo: 'LIVRE', texto: 'Mais pesada que a série anterior' };
      series.push({ ...serie, intensidade: inten });
    }
  }
  return series;
}

/** Tira da observação o que já virou % nas séries (e deixa o resto, como dicas e alternativas). */
export function obsLimpa(obs) {
  const t = (obs ?? '')
    .replace(/Top set\s*-\s*Faça com \+\d+%\s*da carga usada na WS\.?/gi, '')
    .replace(/Back off\s*-\s*Faça com \d+%\s*da carga realizada na WS\.?/gi, '')
    .replace(/Back off com \d+%\s*da carga da WS\.?/gi, '')
    .replace(/\s+/g, ' ').trim();
  return t || null;
}

// ---------------------------------------------------------------- relatório
const rel = { suplementos: [], ergogenicos: [], criados: new Set(), ligados: new Set(), grupos: 0, obsDicas: 0, conflitos: new Set(), linksIgnorados: new Set(), semLink: [], quase: [], modelos: [], mobilidade: [], trocados: new Set(), instrucoes: '', restPause: 0 };
const falar = (...a) => console.log(...a);

// ---------------------------------------------------------------- biblioteca
const biblioteca = new Map(); // chave -> exercício
const donoDoVideo = new Map(); // id do vídeo -> chave
const comVideoNoInicio = new Set(); // exercícios que já tinham vídeo quando a biblioteca foi lida: só esses podem ter o vídeo trocado
const jaTrocados = new Set(); // cada exercício troca de vídeo no máximo uma vez por execução
const donosDaLista = new Set(); // exercícios cujo vídeo veio da lista de vídeos (valem mais que os dos planos)
let seq = 0;

function requisicao(e, mudancas = {}) {
  const x = { ...e, ...mudancas };
  return { nome: x.nome, grupoMuscular: x.grupoMuscular ?? null, equipamento: x.equipamento ?? null, modalidade: x.modalidade, videoUrl: x.videoUrl ?? null, observacoes: x.observacoes ?? null };
}
async function alterarExercicio(e, mudancas) {
  const novo = { ...e, ...mudancas };
  if (!SIMULAR) await chamar('PUT', `/exercicios/${e.id}`, requisicao(e, mudancas));
  biblioteca.set(chave(e.nome), novo);
  return novo;
}
async function criarExercicio(dados) {
  const corpo = requisicao({ equipamento: null, observacoes: null, ...dados });
  const criado = SIMULAR ? { id: `sim-${++seq}`, ...corpo } : await chamar('POST', '/exercicios', corpo);
  biblioteca.set(chave(corpo.nome), criado);
  rel.criados.add(corpo.nome);
  return criado;
}

/** Liga o link ao exercício se ele ainda não tem vídeo e o vídeo não é de outro exercício. */
async function ligarVideo(entrada, url, origem, daLista = false) {
  const limpa = urlLimpa(url);
  if (!limpa) return entrada;
  const id = idDoVideo(limpa);
  const k = chave(entrada.nome);
  const dono = donoDoVideo.get(id);
  if (entrada.videoUrl) {
    if (idDoVideo(entrada.videoUrl) === id) { if (daLista) donosDaLista.add(k); return entrada; }
    if (!(TROCAR_VIDEOS && comVideoNoInicio.has(k) && !jaTrocados.has(k) && (daLista || (!donosDaLista.has(k) && !(dono && dono !== k))))) {
      rel.conflitos.add(`${entrada.nome}: fica ${entrada.videoUrl} (${origem} trazia ${limpa})`);
      return entrada;
    }
    jaTrocados.add(k);
    rel.trocados.add(`${entrada.nome}: ${entrada.videoUrl} -> ${limpa}`);
  } else if (!daLista && dono && dono !== k) {
    rel.linksIgnorados.add(`${entrada.nome}: ${limpa} já é do exercício "${biblioteca.get(dono)?.nome ?? dono}" (${origem})`);
    return entrada;
  }
  if (!donoDoVideo.has(id)) donoDoVideo.set(id, k);
  if (daLista) donosDaLista.add(k);
  const novo = await alterarExercicio(entrada, { videoUrl: limpa });
  rel.ligados.add(entrada.nome);
  return novo;
}

async function carregarBiblioteca() {
  for (const e of await chamar('GET', '/exercicios')) {
    biblioteca.set(chave(e.nome), e);
    const id = e.videoUrl ? idDoVideo(e.videoUrl) : null;
    if (id) { donoDoVideo.set(id, chave(e.nome)); comVideoNoInicio.add(chave(e.nome)); }
  }
  falar(`Biblioteca: ${biblioteca.size} exercícios.`);
}

async function importarVideos() {
  for (const [secao, nome, dica, url] of lerJson('videos.json').linhas) {
    let e = biblioteca.get(chave(nome));
    if (!e) e = await criarExercicio({ nome, modalidade: modalidadeDe(nome), grupoMuscular: grupoDe(nome, secao), observacoes: dica || null });
    else if (dica && !e.observacoes) { e = await alterarExercicio(e, { observacoes: dica }); rel.obsDicas++; }
    if (url) await ligarVideo(e, url, 'lista de vídeos', true);
    else if (!e.videoUrl) rel.semLink.push(nome);
  }
}

async function completarGrupos() {
  for (const e of [...biblioteca.values()]) {
    if (e.grupoMuscular) continue;
    const g = grupoDe(e.nome);
    if (g) { await alterarExercicio(e, { grupoMuscular: g }); rel.grupos++; }
  }
}

/** Exercício da biblioteca para um item de plano (cria se não existir). */
async function exercicioDoPlano(nome, url, origem) {
  const limpo = nome.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const nomeBiblioteca = ALIAS[chave(limpo)] ?? limpo;
  const k = chave(nomeBiblioteca);
  let e = biblioteca.get(k);
  if (!e) {
    // Mesmo vídeo de um exercício de nome parecido que já existe: é o mesmo exercício.
    const id = url ? idDoVideo(urlLimpa(url) ?? '') : null;
    const dono = id ? donoDoVideo.get(id) : null;
    if (dono && parecidos(k, dono)) e = biblioteca.get(dono);
  }
  if (!e) e = await criarExercicio({ nome: nomeBiblioteca, modalidade: modalidadeDe(nomeBiblioteca), grupoMuscular: grupoDe(nomeBiblioteca) });
  if (url) e = await ligarVideo(e, url, origem);
  return e;
}

function quaseDuplicados() {
  const itens = [...biblioteca.entries()].map(([k, e]) => ({ k, e, p: new Set(k.split(' ')) }));
  for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) {
    const inter = [...itens[i].p].filter((x) => itens[j].p.has(x)).length;
    const uniao = new Set([...itens[i].p, ...itens[j].p]).size;
    if (itens[i].k !== itens[j].k && inter / uniao >= 0.75) rel.quase.push(`"${itens[i].e.nome}" ~ "${itens[j].e.nome}"`);
  }
}

// ---------------------------------------------------------------- modelos de treino
async function conteudoTreino(m, regra) {
  const sessoes = [];
  for (const s of m.sessoes) {
    const exercicios = [];
    for (const x of s.exercicios) {
      const e = await exercicioDoPlano(x.nome, x.url, m.nome.replace(/ - .*/, ''));
      const timed = x.series.some((i) => typeof i !== 'string');
      const series = montarSeries(x.series.map((i) => (typeof i === 'string' ? i : { n: i.count, min: null, max: null, tipo: i.tipo, alvoTexto: i.alvoTexto })), x.obs ?? '', regra);
      exercicios.push({
        uid: randomUUID(), exercicioId: SIMULAR && String(e.id).startsWith('sim-') ? null : e.id, nome: x.nome.replace(/\*/g, '').trim(),
        modalidade: e.modalidade, videoUrl: e.videoUrl ?? null, observacao: obsLimpa(x.obs), progressao: x.progressao ?? !timed,
        unidade: x.unidade ?? 'kg', series,
      });
    }
    sessoes.push({ uid: randomUUID(), nome: s.nome, diaSemana: s.diaSemana, tipo: s.tipo, frequenciaSemanal: null, observacao: s.observacao ?? null, cardio: s.cardio ?? null, exercicios });
  }
  return { objetivo: m.objetivo ?? null, orientacoes: m.orientacoes ?? null, sessoes };
}

async function gravarModelo(tipo, nome, descricao, conteudo, existentes) {
  const ja = existentes.find((r) => r.nome === nome);
  if (ja && !SUBSTITUIR) { rel.modelos.push(`${nome}: já existe, mantido`); return; }
  if (SIMULAR) { rel.modelos.push(`${nome}: ${ja ? 'seria substituído' : 'seria criado'}`); return; }
  if (ja) { await chamar('PUT', `/receitas/${ja.id}`, { ...ja, descricao, conteudo }); rel.modelos.push(`${nome}: conteúdo substituído`); }
  else { await chamar('POST', '/receitas', { tipo, nome, descricao, conteudo }); rel.modelos.push(`${nome}: criado`); }
}

function mostrar(nome, c) {
  falar(`\n=== ${nome}\nObjetivo: ${c.objetivo}\nOrientações: ${(c.orientacoes ?? '').slice(0, 120)}...`);
  for (const s of c.sessoes) {
    falar(`\n[${s.diaSemana}] ${s.nome} (${s.tipo}) cardio: ${s.cardio ?? '-'}`);
    for (const e of s.exercicios) {
      falar(`  * ${e.nome} {${e.modalidade}} vídeo:${e.videoUrl ? 'sim' : '-'} obs: ${e.observacao ?? '-'}`);
      falar('     ' + e.series.map((x) => `${x.tipo} ${x.repsMin ?? ''}${x.repsMax && x.repsMax !== x.repsMin ? '-' + x.repsMax : ''}${x.alvoTexto ? ' ' + x.alvoTexto : ''}${x.intensidade.percentual ? ' @' + x.intensidade.percentual : x.intensidade.modo === 'LIVRE' ? ' (livre)' : ''}`).join(' | '));
    }
  }
}

async function importarModelos(regra) {
  const existentes = await chamar('GET', '/receitas?tipo=PLANO_TREINO');
  for (const m of lerJson('modelos.json').modelos) {
    const conteudo = await conteudoTreino(m, regra);
    if (VER && m.nome === VER) mostrar(m.nome, conteudo);
    await gravarModelo('PLANO_TREINO', m.nome, m.descricao, conteudo, existentes);
  }
}

async function importarMobilidade() {
  const existentes = await chamar('GET', '/receitas?tipo=MOBILIDADE').catch(() => []);
  for (const m of lerJson('mobilidade.json').modelos) {
    const conteudo = {
      orientacoes: m.orientacoes ?? null,
      secoes: m.secoes.map((s) => ({
        uid: randomUUID(), titulo: s.titulo,
        itens: s.itens.map(([nome, prescricao, url]) => ({ uid: randomUUID(), nome, prescricao: prescricao || null, videoUrl: urlLimpa(url) })),
      })),
    };
    const ja = existentes.find((r) => r.nome === m.nome);
    if (ja && !SUBSTITUIR) { rel.mobilidade.push(`${m.nome}: já existe, mantido`); continue; }
    if (SIMULAR) { rel.mobilidade.push(`${m.nome}: ${ja ? 'seria substituído' : 'seria criado'}`); continue; }
    if (ja) await chamar('PUT', `/receitas/${ja.id}`, { ...ja, descricao: m.descricao, conteudo });
    else await chamar('POST', '/receitas', { tipo: 'MOBILIDADE', nome: m.nome, descricao: m.descricao, conteudo });
    rel.mobilidade.push(`${m.nome}: ${ja ? 'conteúdo substituído' : 'criado'}`);
  }
}

// ---------------------------------------------------------------- suplementos
/** Mesmo cálculo do `nome_busca` da API (`Buscas.semAcento`): sem acento, minúsculas, espaços simples. */
export function nomeBusca(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Suplementos de dados/suplementos-heavysuppz.json: criados pelo nome; com --substituir atualiza os que já existem. */
async function importarSuplementos() {
  const existentes = new Map((await chamar('GET', '/suplementos')).map((s) => [nomeBusca(s.nome), s]));
  for (const item of lerJson('suplementos-heavysuppz.json').itens) {
    const corpo = {
      nome: item.nome, marca: item.marca ?? null, categoria: item.categoria ?? null, porcao: item.porcao ?? null,
      porcoesPorEmbalagem: item.porcoesPorEmbalagem ?? null, sabores: item.sabores ?? [], link: item.link ?? null,
    };
    const ja = existentes.get(nomeBusca(item.nome));
    if (ja && !SUBSTITUIR) { rel.suplementos.push(`${item.nome}: já existe, mantido`); continue; }
    if (SIMULAR) { rel.suplementos.push(`${item.nome}: ${ja ? 'seria atualizado' : 'seria criado'}`); continue; }
    if (ja) await chamar('PUT', `/suplementos/${ja.id}`, corpo);
    else await chamar('POST', '/suplementos', corpo);
    rel.suplementos.push(`${item.nome}: ${ja ? 'atualizado' : 'criado'}`);
  }
}

// ---------------------------------------------------------------- medicação e ergogênicos
/** Chave do item: nome + concentração + apresentação (a mesma substância existe em concentrações diferentes). */
export function chaveErgogenico(item) {
  return [item.nome, item.concentracao, item.apresentacao].map(nomeBusca).join('|');
}

/**
 * Itens de dados/medicacao-ergogenicos.json: só o que está no rótulo, sem dose. Criados por nome + concentração +
 * apresentação; com --substituir atualiza os que já existem. Dado sensível: precisa de ERGOGENICO_LER/ALTERAR (por
 * padrão só o Administrador); sem a permissão, a etapa é pulada com aviso e o resto da importação segue.
 */
async function importarErgogenicos() {
  let existentes;
  try {
    existentes = new Map((await chamar('GET', '/ergogenicos')).map((e) => [chaveErgogenico(e), e]));
  } catch (e) {
    if (!String(e.message).includes('-> 403')) throw e;
    rel.ergogenicos.push('pulado: o usuário não tem a permissão ERGOGENICO_LER (use um Administrador)');
    return;
  }
  for (const item of lerJson('medicacao-ergogenicos.json').itens) {
    const corpo = {
      categoria: item.categoria, nome: item.nome, principioAtivo: item.principioAtivo ?? null,
      concentracao: item.concentracao ?? null, apresentacao: item.apresentacao ?? null, observacao: item.observacao ?? null,
    };
    const rotulo = [item.nome, item.concentracao, item.apresentacao].filter(Boolean).join(' · ');
    const ja = existentes.get(chaveErgogenico(item));
    if (ja && !SUBSTITUIR) { rel.ergogenicos.push(`${rotulo}: já existe, mantido`); continue; }
    if (SIMULAR) { rel.ergogenicos.push(`${rotulo}: ${ja ? 'seria atualizado' : 'seria criado'}`); continue; }
    if (ja) await chamar('PUT', `/ergogenicos/${ja.id}`, corpo);
    else await chamar('POST', '/ergogenicos', corpo);
    rel.ergogenicos.push(`${rotulo}: ${ja ? 'atualizado' : 'criado'}`);
  }
}

/**
 * As instruções do Plano 16 (FS, cálculo, WS, back off) vão na metodologia padrão, que a API copia para todo plano novo
 * e que chega ao aluno e ao PDF. Só preenche se a metodologia estiver sem instruções (ou com --substituir), para não
 * apagar o que o treinador editou. O mesmo texto está em Plano16.INSTRUCOES (um teste da API confere os dois).
 */
async function importarInstrucoes(padrao) {
  if (!padrao) { rel.instrucoes = 'ATENÇÃO: a consultoria não tem nenhuma metodologia, as instruções NÃO foram gravadas (crie uma em Planejamento e rode de novo)'; process.exitCode = 1; return; }
  const texto = readFileSync(join(AQUI, 'dados', 'instrucoes-plano16.txt'), 'utf8');
  const atual = padrao.conteudo?.instrucoesTreino ?? '';
  if (atual.trim() !== '' && !SUBSTITUIR) { rel.instrucoes = 'a metodologia padrão já tem instruções, mantida'; return; }
  if (atual === texto) { rel.instrucoes = 'a metodologia padrão já tem as instruções do Plano 16'; return; }
  if (SIMULAR) { rel.instrucoes = 'as instruções do Plano 16 seriam gravadas na metodologia padrão'; return; }
  await chamar('PUT', `/receitas/${padrao.id}`, { ...padrao, conteudo: { ...padrao.conteudo, instrucoesTreino: texto } });
  rel.instrucoes = 'instruções do Plano 16 gravadas na metodologia padrão';
}

// ---------------------------------------------------------------- principal
async function principal() {
  await entrar();
  falar(SIMULAR ? 'SIMULAÇÃO: nada será gravado.' : 'Gravando na API', BASE);
  // A metodologia padrão é a primeira do tipo METODOLOGIA (a mesma que a API vincula a todo plano novo).
  const padrao = (await chamar('GET', '/receitas?tipo=METODOLOGIA'))?.[0] ?? null;
  const regra = Object.fromEntries(Object.entries(padrao?.conteudo?.regraPreparacao ?? REGRA_PADRAO).map(([k, v]) => [Number(k), v]));
  await importarInstrucoes(padrao);
  await carregarBiblioteca();
  await importarVideos();
  await importarModelos(regra);
  await importarMobilidade();
  await importarSuplementos();
  await importarErgogenicos();
  await completarGrupos();
  quaseDuplicados();
  const lista = (titulo, itens) => { if (itens.length) { falar(`\n${titulo} (${itens.length}):`); itens.forEach((i) => falar(`  - ${i}`)); } };
  falar(`\nExercícios criados: ${rel.criados.size}. Vídeos ligados: ${rel.ligados.size}.`);
  lista('Vídeos trocados (--trocar-videos)', [...rel.trocados]);
  falar(`\nGrupos musculares preenchidos em exercícios que estavam sem grupo: ${rel.grupos}. Dicas gravadas como observação: ${rel.obsDicas}.`);
  lista('Vídeo diferente do que já estava na biblioteca (mantido o da biblioteca)', [...rel.conflitos]);
  lista('Links não usados porque o vídeo é de outro exercício', [...rel.linksIgnorados]);
  lista('Exercícios da lista de vídeos sem link', rel.semLink);
  lista('Nomes parecidos na biblioteca (conferir se são o mesmo exercício)', rel.quase);
  falar(`\nInstruções do Plano 16: ${rel.instrucoes}.`);
  lista('Modelos de treino', rel.modelos);
  if (rel.restPause) falar(`Séries "Rest pause" lidas: ${rel.restPause} (cada uma vira WS com o alvo "Rest pause", sem técnica: complete no editor).`);
  lista('Modelos de mobilidade', rel.mobilidade);
  lista('Suplementos', rel.suplementos);
  lista('Medicação e ergogênicos', rel.ergogenicos);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('importar.mjs')) {
  principal().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
}
