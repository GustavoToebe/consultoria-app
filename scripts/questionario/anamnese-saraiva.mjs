#!/usr/bin/env node
// Atualiza a anamnese "Anamnese Saraiva Team" de uma consultoria para o conteúdo de `anamnese-saraiva-lib.mjs` e publica
// uma versão nova. Reaproveita as imagens que já estão nela (Bristol, Armstrong, modelo das fotos e máquinas), casando
// pelo texto. Sem a anamnese, cria uma (sem imagens: o treinador as põe pelo editor).
//
// Uso (a senha só no ambiente, nunca na linha de comando nem em log):
//   ANAMNESE_EMAIL=... ANAMNESE_SENHA=... [CODIGO_MFA=...] [API_URL=https://consultoria.servirea.com.br/api] \
//     node scripts/questionario/anamnese-saraiva.mjs            # simula: lê, monta e mostra o resumo, sem gravar
//   ... node scripts/questionario/anamnese-saraiva.mjs --gravar  # salva o rascunho, valida e publica
//
// Se a validação da API recusar, o rascunho anterior volta e nada é publicado. Alunos que já receberam a anamnese
// continuam com a versão que receberam (a versão publicada é imutável); a nova vale para as próximas atribuições.

import { DESCRICAO, NOME, aplicarImagens, conteudoDaAnamnese, imagensDoConteudo, resumo } from './anamnese-saraiva-lib.mjs';

const BASE = (process.env.API_URL ?? 'https://consultoria.servirea.com.br/api').replace(/\/$/, '');
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
  const email = process.env.ANAMNESE_EMAIL;
  const senha = process.env.ANAMNESE_SENHA;
  if (!email || !senha) sair('Defina ANAMNESE_EMAIL e ANAMNESE_SENHA no ambiente (não na linha de comando).');
  const corpo = { email, senha, ...(process.env.CODIGO_MFA ? { codigoMfa: process.env.CODIGO_MFA } : {}) };
  const j = await chamar('POST', '/auth/login', corpo);
  token = j.accessToken;
  if (!token) sair('Login sem token de acesso.');
}

async function principal() {
  await entrar();
  const eu = await chamar('GET', '/eu');
  if (!eu.permissoes?.includes('QUESTIONARIO_ALTERAR')) sair('Este login não tem QUESTIONARIO_ALTERAR. Nada foi gravado.');

  const lista = await chamar('GET', '/questionarios?finalidade=ANAMNESE');
  const existente = lista.find((x) => x.nome === NOME) ?? null;
  const detalhe = existente ? await chamar('GET', `/questionarios/${existente.id}`) : null;

  const imagens = imagensDoConteudo(detalhe?.rascunho);
  const { conteudo, faltando } = aplicarImagens(conteudoDaAnamnese(), imagens);
  const r = resumo(conteudo);
  console.log(`${existente ? `Anamnese encontrada (versão publicada ${existente.versaoPublicada}).` : 'Anamnese não existe: será criada.'}`);
  console.log(`Novo conteúdo: ${r.secoes} seções, ${r.perguntas} perguntas, ${r.imagens} imagens reaproveitadas.`);
  if (faltando.length) console.log(`Sem imagem (o treinador pode pôr pelo editor): ${faltando.join('; ')}.`);
  if (!gravar) {
    console.log('Simulação: nada foi gravado. Rode com --gravar para publicar.');
    return;
  }

  const atual = detalhe ?? await chamar('POST', '/questionarios', { nome: NOME, descricao: DESCRICAO, origem: 'VAZIO', finalidade: 'ANAMNESE' });
  const anterior = atual.rascunho;
  const salvo = await chamar('PUT', `/questionarios/${atual.id}`, { nome: NOME, descricao: DESCRICAO, conteudo, versao: atual.versao });
  const validacao = await chamar('POST', `/questionarios/${atual.id}/validar`);
  if (validacao.erros?.length) {
    console.error(`A API recusou ${validacao.erros.length} ponto(s):`);
    for (const e of validacao.erros) console.error(`- ${e.caminho}: ${e.mensagem}`);
    if (detalhe) {
      await chamar('PUT', `/questionarios/${atual.id}`, { nome: detalhe.nome, descricao: detalhe.descricao, conteudo: anterior, versao: salvo.versao });
      console.error('O rascunho anterior foi restaurado. Nada foi publicado.');
    }
    process.exit(1);
  }
  for (const a of validacao.avisos ?? []) console.log(`Aviso: ${a.caminho}: ${a.mensagem}`);
  const publicado = await chamar('POST', `/questionarios/${atual.id}/publicar`, { versao: salvo.versao, confirmarAvisos: true });
  console.log(`Publicada a versão ${publicado.versaoPublicada}. Alunos já atribuídos seguem na versão que receberam.`);
}

principal().catch((e) => sair(e.message));
