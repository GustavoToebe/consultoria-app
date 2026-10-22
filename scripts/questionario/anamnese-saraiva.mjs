#!/usr/bin/env node
// Atualiza a anamnese "Anamnese Saraiva Team" de uma consultoria para o conteúdo de `anamnese-saraiva-lib.mjs` e publica
// uma versão nova. Reaproveita as imagens que já estão nela (Bristol, Armstrong, modelo das fotos e máquinas), casando
// pelo texto. Sem a anamnese, cria uma. Com `--imagens <pasta>` (fora do repositório: são recortes com marca d'água de
// terceiros), envia à consultoria as imagens que faltam, pelos nomes de `ARQUIVO_DA_IMAGEM`; sem a opção, as que
// faltam ficam para o treinador pôr pelo editor.
//
// Uso (a senha só no ambiente, nunca na linha de comando nem em log):
//   ANAMNESE_EMAIL=... ANAMNESE_SENHA=... [CODIGO_MFA=...] [API_URL=https://consultoria.servirea.com.br/api] \
//     node scripts/questionario/anamnese-saraiva.mjs            # simula: lê, monta e mostra o resumo, sem gravar
//   ... node scripts/questionario/anamnese-saraiva.mjs --gravar  # salva o rascunho, valida e publica
//   ... --imagens <pasta>                                         # junto com qualquer um dos dois: usa os arquivos
//
// Se a validação da API recusar, o rascunho anterior volta e nada é publicado. Alunos que já receberam a anamnese
// continuam com a versão que receberam (a versão publicada é imutável); a nova vale para as próximas atribuições.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseDaApiOuSair, corpoDoLogin } from '../importacao/acesso-lib.mjs';
import {
  ARQUIVO_DA_IMAGEM, DESCRICAO, NOME, aplicarImagens, comImagensEnviadas, conteudoDaAnamnese, imagensDoConteudo, resumo,
} from './anamnese-saraiva-lib.mjs';

const BASE = baseDaApiOuSair('https://consultoria.servirea.com.br/api');
const gravar = process.argv.includes('--gravar');
const indiceImagens = process.argv.indexOf('--imagens');
const pastaImagens = indiceImagens > 0 ? process.argv[indiceImagens + 1] : null;

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

/** Pasta das imagens: tem de existir e ficar fora do repositório (as imagens não podem ir para o git). */
function conferirPasta() {
  if (indiceImagens > 0 && !pastaImagens) sair('Informe a pasta depois de --imagens.');
  if (!pastaImagens) return null;
  const pasta = resolve(pastaImagens);
  const raiz = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const dentro = relative(raiz, pasta);
  if (!dentro.startsWith('..') && !isAbsolute(dentro)) sair('A pasta das imagens precisa ficar fora do repositório.');
  if (!existsSync(pasta)) sair('A pasta das imagens não existe.');
  return pasta;
}

async function enviarImagem(caminho) {
  const corpo = new FormData();
  corpo.append('arquivo', new Blob([readFileSync(caminho)], { type: 'image/jpeg' }), 'imagem.jpg');
  const r = await fetch(`${BASE}/questionarios/imagens`, {
    method: 'POST',
    headers: { 'X-Treinos-Cliente': 'nativo', authorization: `Bearer ${token}` },
    body: corpo,
  });
  const texto = await r.text();
  if (!r.ok) {
    let codigo = '';
    try { codigo = JSON.parse(texto).codigo ?? ''; } catch { /* corpo não é JSON */ }
    throw new Error(`POST /questionarios/imagens -> ${r.status} ${codigo}`.trim());
  }
  return JSON.parse(texto).id;
}

async function entrar() {
  const email = process.env.ANAMNESE_EMAIL;
  const senha = process.env.ANAMNESE_SENHA;
  if (!email || !senha) sair('Defina ANAMNESE_EMAIL e ANAMNESE_SENHA no ambiente (não na linha de comando).');
  const j = await chamar('POST', '/auth/login', corpoDoLogin(email, senha));
  token = j.accessToken;
  if (!token) sair('Login sem token de acesso.');
}

async function principal() {
  const pasta = conferirPasta();
  await entrar();
  const eu = await chamar('GET', '/eu');
  if (!eu.permissoes?.includes('QUESTIONARIO_ALTERAR')) sair('Este login não tem QUESTIONARIO_ALTERAR. Nada foi gravado.');

  const lista = await chamar('GET', '/questionarios?finalidade=ANAMNESE');
  const existente = lista.find((x) => x.nome === NOME) ?? null;
  const detalhe = existente ? await chamar('GET', `/questionarios/${existente.id}`) : null;

  let imagens = imagensDoConteudo(detalhe?.rascunho);
  let { conteudo, faltando, chavesFaltando } = aplicarImagens(conteudoDaAnamnese(), imagens);
  const r = resumo(conteudo);
  console.log(`${existente ? `Anamnese encontrada (versão publicada ${existente.versaoPublicada}).` : 'Anamnese não existe: será criada.'}`);
  console.log(`Novo conteúdo: ${r.secoes} seções, ${r.perguntas} perguntas, ${r.imagens} imagens reaproveitadas.`);
  const paraEnviar = [];
  if (pasta) {
    const semArquivo = [];
    for (const f of chavesFaltando) {
      const nome = ARQUIVO_DA_IMAGEM[f.imagem];
      if (nome && existsSync(join(pasta, nome))) paraEnviar.push({ ...f, nome });
      else semArquivo.push(nome ?? f.imagem);
    }
    console.log(`Da pasta: ${paraEnviar.length} imagens para enviar.`);
    if (semArquivo.length) console.log(`Arquivos que não estão na pasta: ${semArquivo.join(', ')}.`);
  } else if (faltando.length) {
    console.log(`Sem imagem (use --imagens <pasta> ou o editor): ${faltando.join('; ')}.`);
  }
  if (!gravar) {
    console.log('Simulação: nada foi gravado nem enviado. Rode com --gravar para publicar.');
    return;
  }

  if (paraEnviar.length) {
    const enviadas = [];
    for (const f of paraEnviar) enviadas.push({ ...f, imagemId: await enviarImagem(join(pasta, f.nome)) });
    console.log(`Enviadas ${enviadas.length} imagens.`);
    imagens = comImagensEnviadas(imagens, enviadas);
    ({ conteudo, faltando } = aplicarImagens(conteudoDaAnamnese(), imagens));
    if (faltando.length) console.log(`Ainda sem imagem: ${faltando.join('; ')}.`);
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
