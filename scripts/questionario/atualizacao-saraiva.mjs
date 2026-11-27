#!/usr/bin/env node
// Reescreve as perguntas de texto livre do questionário de atualização PADRÃO da consultoria (o de finalidade ATUALIZACAO
// marcado como padrão; achado pela API, nunca por id no código) para perguntas de tocar, e publica uma versão nova. As
// perguntas que já eram de tocar (data, peso, fotos, notas 0 a 10, notas por dia) e as seções ficam como estão: o script lê
// o rascunho que está na API e troca só as 8 perguntas abaixo, na mesma posição. Lista e motivos em
// `docs/planos/atualizacao-pasta-e-questionarios.md` (bloco C).
//
// O tipo de um id já publicado não muda entre versões (a API recusa), então cada pergunta nova leva um id novo e a de texto
// livre sai. As respostas de atualizações já enviadas continuam legíveis: elas guardam a versão que o aluno respondeu.
//
// O motivo de "Qual dia foi mais desgastante?" é OPCIONAL, como o das outras perguntas novas (decisão do Gustavo, 27/11/2026).
//
// SEGURANÇA: o padrão é SIMULAR (lê, monta, imprime a lista final e o diff, sem gravar nada). Só `--gravar` salva o rascunho,
// valida e publica; se a API recusar, o rascunho anterior volta e nada é publicado. Mostre a lista ao Gustavo antes de gravar
// em produção.
//
// Uso (a senha só no ambiente, nunca na linha de comando nem em log):
//   ATUALIZACAO_EMAIL=... ATUALIZACAO_SENHA=... [CODIGO_MFA=...] [API_URL=https://overtraining.app/api] \
//     node scripts/questionario/atualizacao-saraiva.mjs            # simula
//   ... node scripts/questionario/atualizacao-saraiva.mjs --gravar  # salva o rascunho, valida e publica

import { baseDaApiOuSair, corpoDoLogin, permissoesQueFaltam } from '../importacao/acesso-lib.mjs';
import { mesmoConteudo } from './inscricao-saraiva-lib.mjs';

/** Motivo de "Qual dia foi mais desgastante?": 'OBRIGATORIO' ou 'OPCIONAL' (decisão do Gustavo, 27/11/2026). */
const MOTIVO_DO_DIA_DESGASTANTE = 'OPCIONAL';

const CAPACIDADE_DE_TEXTO_TOTAL = 40000; // LimitesQuestionario.CAPACIDADE_DE_TEXTO_TOTAL
const MOTIVO_TAMANHO = 300; // ValidadorQuestionario.MOTIVO_TAMANHO
const ITENS_MAXIMO = 20; // ValidadorQuestionario.ITENS_MAXIMO
const PERMISSOES = ['QUESTIONARIO_ALTERAR'];
const SIM = { valores: ['sim'] };
const NAO = { valores: ['nao'] };

const opcoes = (...pares) => pares.map(([id, rotulo]) => ({ id, rotulo }));
const base = (id, tipo, rotulo, extra = {}) => ({ id, tipo, rotulo, obrigatoria: false, ...extra });
const quando = (perguntaId, condicao) => ({ mostrarSe: { perguntaId, ...condicao } });
// shortcut: `max` (itens que o aluno marca) escolhido para caber na capacidade de texto de 40000 com as 10 perguntas de
// texto livre que ficam; subir exige tirar texto livre de outro lugar.
const itens = (id, rotulo, fonte, max, motivo, extra = {}) => base(id, 'ITENS_DO_PLANO', rotulo, { fonte, max, motivo, ...extra });

const DIAS = opcoes(['seg', 'Segunda'], ['ter', 'Terça'], ['qua', 'Quarta'], ['qui', 'Quinta'], ['sex', 'Sexta'], ['sab', 'Sábado'], ['dom', 'Domingo']);

/** As 8 trocas: `de` é o id da pergunta de texto livre de hoje; `para` é o que entra no lugar, na mesma posição. */
const TROCAS = [
  { de: 'alim_fome', para: [
    base('alim_fome_periodo', 'MULTIPLA_ESCOLHA', 'Momento que mais ficou com fome', {
      opcoes: opcoes(['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['madrugada', 'Madrugada'], ['normal', 'Não senti mais fome que o normal']),
    }),
  ] },
  { de: 'alim_enjoou', para: [
    base('alim_enjoou_sn', 'SIM_NAO', 'Algum alimento que enjoou ou gostaria de substituir?'),
    itens('alim_enjoou_itens', 'Quais alimentos você quer substituir?', 'ALIMENTOS_DA_DIETA', 10, 'OPCIONAL', quando('alim_enjoou_sn', SIM)),
  ] },
  { de: 'treino_dias', para: [
    // A ajuda automática da média de dias não vale em ESCOLHA_UNICA (só TEXTO e NUMERO): ver o relatório.
    base('treino_dias_faltou', 'ESCOLHA_UNICA', 'Quantos dias por semana está conseguindo treinar?', {
      opcoes: opcoes(['todos', 'Todos os prescritos'], ['faltei-1', 'Faltei 1 dia'], ['faltei-2-ou-mais', 'Faltei 2 ou mais']),
    }),
  ] },
  { de: 'treino_dores', para: [
    base('treino_dores_sn', 'SIM_NAO', 'Sentiu dores ou dificuldades?'),
    itens('treino_dores_itens', 'Em quais exercícios?', 'EXERCICIOS_DO_TREINO', 10, 'OPCIONAL', {
      rotuloMotivo: 'Onde e como doeu?', ...quando('treino_dores_sn', SIM),
    }),
  ] },
  { de: 'treino_descanso', para: [
    base('treino_descanso_sn', 'SIM_NAO', 'Precisou fazer descanso no meio da semana?'),
    base('treino_descanso_dias', 'MULTIPLA_ESCOLHA', 'Qual dia?', { opcoes: DIAS, ...quando('treino_descanso_sn', SIM) }),
  ] },
  { de: 'fb_desgastante', para: [
    itens('fb_desgastante_dia', 'Qual dia foi mais desgastante?', 'DIAS_TREINADOS', 1, MOTIVO_DO_DIA_DESGASTANTE),
  ] },
  { de: 'fb_substituiu', para: [
    base('fb_substituiu_sn', 'SIM_NAO', 'Teve algum exercício que substituiu por não ter o maquinário?'),
    itens('fb_substituiu_itens', 'Quais exercícios você substituiu?', 'EXERCICIOS_DO_TREINO', 10, 'OPCIONAL', {
      rotuloMotivo: 'O que usou no lugar?', ...quando('fb_substituiu_sn', SIM),
    }),
    base('fb_substituiu_foto', 'FOTOS', 'Foto do aparelho que você usou', { max: 2, ...quando('fb_substituiu_sn', SIM) }),
  ] },
  { de: 'fb_recuperou', para: [
    base('fb_recuperou_sn', 'SIM_NAO', 'Seu músculo recuperou até a próxima sessão?'),
    itens('fb_recuperou_dias', 'Em quais treinos você ainda estava dolorido?', 'DIAS_TREINADOS', 10, 'OPCIONAL', quando('fb_recuperou_sn', NAO)),
  ] },
];

const ids = (lista) => lista.map((p) => p.id);

/**
 * Troca cada pergunta de texto livre pelas novas, na mesma posição. Idempotente: se a troca já foi feita (ids novos no
 * lugar), recoloca a definição do script no primeiro id novo achado. Pergunta que não está nem como `de` nem como nova
 * volta em `ausentes` (o treinador mexeu no padrão): nada é inventado.
 */
function aplicarTrocas(rascunho) {
  const conteudo = JSON.parse(JSON.stringify(rascunho));
  const ausentes = [];
  for (const troca of TROCAS) {
    const alvos = new Set([troca.de, ...ids(troca.para)]);
    const secao = conteudo.secoes.find((s) => s.perguntas.some((p) => alvos.has(p.id)));
    if (!secao) { ausentes.push(troca.de); continue; }
    const posicao = secao.perguntas.findIndex((p) => alvos.has(p.id));
    secao.perguntas = secao.perguntas.filter((p) => !alvos.has(p.id));
    secao.perguntas.splice(posicao, 0, ...JSON.parse(JSON.stringify(troca.para)));
  }
  return { conteudo, ausentes };
}

const perguntasDe = (c) => c.secoes.flatMap((s) => s.perguntas);

/** O que o ValidadorQuestionario conferiria e dá para saber sem a API: ids repetidos e capacidade de texto. */
function problemasLocais(conteudo) {
  const problemas = [];
  const todas = perguntasDe(conteudo);
  const repetidos = ids(todas).filter((id, i, a) => a.indexOf(id) !== i);
  if (repetidos.length) problemas.push(`ids repetidos: ${[...new Set(repetidos)].join(', ')}`);
  const capacidade = todas.reduce((t, p) => t + (p.tipo === 'TEXTO' ? 500 : p.tipo === 'TEXTO_LONGO' ? 2000
    : p.tipo === 'ITENS_DO_PLANO' && p.motivo && p.motivo !== 'NENHUM' ? (p.max ?? ITENS_MAXIMO) * MOTIVO_TAMANHO : 0), 0);
  if (capacidade > CAPACIDADE_DE_TEXTO_TOTAL) problemas.push(`capacidade de texto ${capacidade} acima de ${CAPACIDADE_DE_TEXTO_TOTAL}`);
  return problemas;
}

function descrever(p, porId) {
  const partes = [];
  if (p.opcoes) partes.push(`opções: ${p.opcoes.map((o) => o.rotulo).join(' | ')}`);
  if (p.tipo === 'ITENS_DO_PLANO') {
    partes.push(`fonte ${p.fonte}`, p.max === 1 ? 'escolha única' : `até ${p.max ?? ITENS_MAXIMO} itens`, `motivo ${p.motivo ?? 'NENHUM'}`);
    if (p.rotuloMotivo) partes.push(`rótulo do motivo "${p.rotuloMotivo}"`);
  }
  if (p.tipo === 'FOTOS') partes.push(`até ${p.max ?? 1} foto(s)`);
  if (p.mostrarSe) {
    const alvo = porId.get(p.mostrarSe.perguntaId);
    partes.push(`só aparece se "${alvo?.rotulo ?? p.mostrarSe.perguntaId}" = ${p.mostrarSe.valores.map((v) => (v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : v)).join(' ou ')}`);
  }
  return `[${p.tipo}] ${p.rotulo}${partes.length ? `  (${partes.join('; ')})` : ''}`;
}

function imprimirLista(conteudo) {
  const porId = new Map(perguntasDe(conteudo).map((p) => [p.id, p]));
  const novas = new Set(TROCAS.flatMap((t) => ids(t.para)));
  let n = 0;
  console.log(`Lista final (${porId.size} perguntas; "+" = pergunta nova deste script):`);
  for (const s of conteudo.secoes) {
    console.log(`  Seção: ${s.titulo}`);
    for (const p of s.perguntas) console.log(`    ${String(++n).padStart(2)}. ${novas.has(p.id) ? '+ ' : ''}${descrever(p, porId)}`);
  }
}

function imprimirDiff(antes, depois) {
  const novos = new Set(ids(perguntasDe(depois)));
  const velhos = new Set(ids(perguntasDe(antes)));
  const saem = perguntasDe(antes).filter((p) => !novos.has(p.id));
  const entram = perguntasDe(depois).filter((p) => !velhos.has(p.id));
  console.log(`Diff contra o rascunho atual: ${saem.length} saem, ${entram.length} entram, ${[...velhos].filter((i) => novos.has(i)).length} ficam como estão.`);
  for (const p of saem) console.log(`  - [${p.tipo}] ${p.rotulo}`);
  for (const p of entram) console.log(`  + [${p.tipo}] ${p.rotulo}`);
}

// ---- API ----

const BASE = baseDaApiOuSair('https://overtraining.app/api');
const gravar = process.argv.includes('--gravar');

function sair(mensagem, codigo = 1) {
  console.error(mensagem);
  process.exit(codigo);
}

let token = null;
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'X-Treinos-Cliente': 'nativo', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) {
    // Só status e código: a mensagem pode repetir o que foi enviado.
    let codigo = '';
    try { codigo = JSON.parse(texto).codigo ?? ''; } catch { /* corpo não é JSON */ }
    throw new Error(`${metodo} ${caminho.replace(/[0-9a-f-]{36}/g, '<id>').replace(/\?.*/, '')} -> ${r.status} ${codigo}`.trim());
  }
  return texto ? JSON.parse(texto) : null;
}

async function entrar() {
  const email = process.env.ATUALIZACAO_EMAIL;
  const senha = process.env.ATUALIZACAO_SENHA;
  if (!email || !senha) sair('Defina ATUALIZACAO_EMAIL e ATUALIZACAO_SENHA no ambiente (não na linha de comando).');
  const j = await chamar('POST', '/auth/login', corpoDoLogin(email, senha));
  token = j.accessToken;
  if (!token) sair('Login sem token de acesso.');
}

async function principal() {
  if (!['OBRIGATORIO', 'OPCIONAL'].includes(MOTIVO_DO_DIA_DESGASTANTE)) sair('MOTIVO_DO_DIA_DESGASTANTE precisa ser OBRIGATORIO ou OPCIONAL.');
  await entrar();
  const eu = await chamar('GET', '/eu');
  const faltam = permissoesQueFaltam(eu, PERMISSOES);
  if (faltam.length) sair(`Faltam permissões para este login: ${faltam.join(', ')}. Nada foi gravado.`);

  const lista = await chamar('GET', '/questionarios?finalidade=ATUALIZACAO');
  const padrao = lista.find((x) => x.padrao);
  if (!padrao) sair('Não há questionário de atualização padrão nesta consultoria. Nada foi gravado.');
  const detalhe = await chamar('GET', `/questionarios/${padrao.id}`);

  const { conteudo, ausentes } = aplicarTrocas(detalhe.rascunho);
  if (ausentes.length) sair(`O padrão não tem mais as perguntas: ${ausentes.join(', ')}. Ele foi editado à mão; nada foi gravado.`);
  const problemas = problemasLocais(conteudo);
  if (problemas.length) sair(`O conteúdo montado não cabe nos limites:\n- ${problemas.join('\n- ')}\nNada foi gravado.`);

  const rascunhoIgual = mesmoConteudo(detalhe.rascunho, conteudo);
  const publicadoIgual = detalhe.versaoPublicada > 0 && !detalhe.alteradoDesdePublicacao;
  const precisaPublicar = !(rascunhoIgual && publicadoIgual);

  console.log(`Questionário padrão da atualização: "${detalhe.nome}" (versão publicada ${detalhe.versaoPublicada}); rascunho ${rascunhoIgual ? 'igual ao' : 'diferente do'} que o script monta.`);
  imprimirLista(conteudo);
  imprimirDiff(detalhe.rascunho, conteudo);
  console.log(`Motivo de "Qual dia foi mais desgastante?": ${MOTIVO_DO_DIA_DESGASTANTE} (decisão do Gustavo, 27/11/2026).`);
  console.log(precisaPublicar ? 'Será salvo, validado e publicado.' : 'Já está publicado com este conteúdo: nada a publicar.');
  if (!gravar) {
    console.log('Simulação: nada foi gravado. Rode com --gravar para publicar.');
    return;
  }
  if (!precisaPublicar) {
    console.log('Nada a gravar: o questionário de atualização já está como o script monta.');
    return;
  }

  // Salva o rascunho (se mudou), valida e publica. A API recusando, o rascunho anterior volta.
  let versao = detalhe.versao;
  if (!rascunhoIgual) {
    const salvo = await chamar('PUT', `/questionarios/${padrao.id}`, { nome: detalhe.nome, descricao: detalhe.descricao ?? '', conteudo, versao });
    versao = salvo.versao;
  }
  const restaurar = async () => {
    if (rascunhoIgual) return;
    await chamar('PUT', `/questionarios/${padrao.id}`, { nome: detalhe.nome, descricao: detalhe.descricao ?? '', conteudo: detalhe.rascunho, versao });
    console.error('O rascunho anterior foi restaurado. Nada foi publicado.');
  };
  try {
    const validacao = await chamar('POST', `/questionarios/${padrao.id}/validar`);
    if (validacao.erros?.length) {
      console.error(`A API recusou ${validacao.erros.length} ponto(s):`);
      for (const e of validacao.erros) console.error(`- ${e.caminho}: ${e.mensagem}`);
      await restaurar();
      process.exit(1);
    }
    for (const a of validacao.avisos ?? []) console.log(`Aviso: ${a.caminho}: ${a.mensagem}`);
    const publicado = await chamar('POST', `/questionarios/${padrao.id}/publicar`, { versao, confirmarAvisos: true });
    console.log(`Publicada a versão ${publicado.versaoPublicada}. Atualizações já enviadas seguem na versão que o aluno respondeu.`);
  } catch (e) {
    await restaurar().catch(() => { /* o erro original é o que importa */ });
    throw e;
  }
}

principal().catch((e) => sair(e.message));
