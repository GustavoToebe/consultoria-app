#!/usr/bin/env node
// Monta a inscrição do Saraiva Team numa consultoria: o questionário "Inscrição Saraiva Team" (finalidade INSCRICAO,
// 14 perguntas de `inscricao-saraiva-lib.mjs`, a 4b só aparece com "Sim" na planilha do time), publicado e definido
// como o padrão da inscrição; os campos fixos sexo, objetivo, "o que procura" e modalidade escondidos; e o texto de
// apresentação do link trocado. Nada mais da configuração do link muda (ligado ou desligado, responsável, código).
//
// Uso (a senha só no ambiente, nunca na linha de comando nem em log):
//   INSCRICAO_EMAIL=... INSCRICAO_SENHA=... [CODIGO_MFA=...] [API_URL=https://overtraining.app/api] \
//     node scripts/questionario/inscricao-saraiva.mjs            # simula: lê, monta e mostra o resumo, sem gravar
//   ... node scripts/questionario/inscricao-saraiva.mjs --gravar  # grava, publica e define como padrão
//
// Idempotente: rodar de novo não cria nem publica nada se o que está na API já é o que o script monta. Se a API recusar
// o conteúdo, o rascunho anterior volta e nada é publicado. Quem já se inscreveu fica com a versão que respondeu (a
// versão publicada é imutável); a nova vale para as próximas inscrições.

import { baseDaApiOuSair, corpoDoLogin, permissoesQueFaltam } from '../importacao/acesso-lib.mjs';
import {
  CAMPOS_ESCONDIDOS, DESCRICAO, NOME, TEXTO_DO_LINK, conteudoDaInscricao, mesmoConteudo, planoDaConfiguracao, problemasDaInscricao,
  resumo,
} from './inscricao-saraiva-lib.mjs';

const BASE = baseDaApiOuSair('https://overtraining.app/api');
const gravar = process.argv.includes('--gravar');
const PERMISSOES = ['QUESTIONARIO_ALTERAR', 'INSCRICAO_ALTERAR'];

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
  const email = process.env.INSCRICAO_EMAIL;
  const senha = process.env.INSCRICAO_SENHA;
  if (!email || !senha) sair('Defina INSCRICAO_EMAIL e INSCRICAO_SENHA no ambiente (não na linha de comando).');
  const j = await chamar('POST', '/auth/login', corpoDoLogin(email, senha));
  token = j.accessToken;
  if (!token) sair('Login sem token de acesso.');
}

async function principal() {
  await entrar();
  const eu = await chamar('GET', '/eu');
  const faltam = permissoesQueFaltam(eu, PERMISSOES);
  if (faltam.length) sair(`Faltam permissões para este login: ${faltam.join(', ')}. Nada foi gravado.`);

  const conteudo = conteudoDaInscricao();
  const problemas = problemasDaInscricao(conteudo);
  if (problemas.length) sair(`O conteúdo montado não vale na inscrição:\n- ${problemas.join('\n- ')}\nNada foi gravado.`);

  // Só os ativos: o nome é único entre eles (409 QUESTIONARIO_NOME_EM_USO), então um arquivado não atrapalha.
  const lista = await chamar('GET', '/questionarios?finalidade=INSCRICAO');
  const existente = lista.find((x) => x.nome === NOME) ?? null;
  const detalhe = existente ? await chamar('GET', `/questionarios/${existente.id}`) : null;
  const padraoAtual = lista.find((x) => x.padrao) ?? null;
  const config = await chamar('GET', '/inscricoes/configuracao');

  const rascunhoIgual = !!detalhe && mesmoConteudo(detalhe.rascunho, conteudo) && detalhe.nome === NOME && (detalhe.descricao ?? '') === DESCRICAO;
  const publicadoIgual = !!detalhe && detalhe.versaoPublicada > 0 && !detalhe.alteradoDesdePublicacao;
  const precisaSalvar = !rascunhoIgual;
  const precisaPublicar = !(rascunhoIgual && publicadoIgual);
  const precisaPadrao = !detalhe?.padrao;
  const plano = planoDaConfiguracao(config);

  const r = resumo(conteudo);
  console.log(detalhe
    ? `Questionário "${NOME}" encontrado (versão publicada ${detalhe.versaoPublicada}); rascunho ${rascunhoIgual ? 'igual ao' : 'diferente do'} que o script monta.`
    : `Questionário "${NOME}" não existe: será criado.`);
  console.log(`Conteúdo: ${r.secoes} seção, ${r.perguntas} perguntas (${r.obrigatorias} obrigatórias, ${r.condicionais} condicional).`);
  console.log(precisaPublicar ? 'Será salvo, validado e publicado.' : 'Já está publicado com este conteúdo: nada a publicar.');
  console.log(precisaPadrao
    ? `Será o padrão da inscrição${padraoAtual ? ` (hoje o padrão é "${padraoAtual.nome}")` : ''}.`
    : 'Já é o padrão da inscrição.');
  console.log(`Link: ${config.aberta ? 'ligado' : 'desligado'}${config.responsavelId ? ', com responsável' : ', sem responsável'} (não mudam).`);
  console.log(plano.texto ? `Texto de apresentação: será trocado (${TEXTO_DO_LINK.length} caracteres).` : 'Texto de apresentação: já é este.');
  console.log(plano.campos
    ? `Campos fixos escondidos: ${CAMPOS_ESCONDIDOS.join(', ')}${plano.voltamAAparecer.length ? `; voltam a aparecer: ${plano.voltamAAparecer.join(', ')}` : ''}.`
    : `Campos fixos escondidos: já são ${CAMPOS_ESCONDIDOS.join(', ')}.`);
  if (!gravar) {
    console.log('Simulação: nada foi gravado. Rode com --gravar para aplicar.');
    return;
  }
  if (!precisaPublicar && !precisaPadrao && !plano.texto && !plano.campos) {
    console.log('Nada a gravar: a inscrição do Saraiva já está como o script monta.');
    return;
  }

  // 1. Questionário: cria (ou reaproveita), salva o rascunho, valida e publica. A API recusando, o rascunho anterior volta.
  let atual = detalhe ?? await chamar('POST', '/questionarios', { nome: NOME, descricao: DESCRICAO, origem: 'VAZIO', finalidade: 'INSCRICAO' });
  let versao = atual.versao;
  if (precisaSalvar) {
    const salvo = await chamar('PUT', `/questionarios/${atual.id}`, { nome: NOME, descricao: DESCRICAO, conteudo, versao });
    versao = salvo.versao;
  }
  const restaurar = async () => {
    if (!detalhe || !precisaSalvar) return;
    await chamar('PUT', `/questionarios/${atual.id}`, { nome: detalhe.nome, descricao: detalhe.descricao ?? '', conteudo: detalhe.rascunho, versao });
    console.error('O rascunho anterior foi restaurado. Nada foi publicado.');
  };
  if (precisaPublicar) {
    try {
      const validacao = await chamar('POST', `/questionarios/${atual.id}/validar`);
      if (validacao.erros?.length) {
        console.error(`A API recusou ${validacao.erros.length} ponto(s):`);
        for (const e of validacao.erros) console.error(`- ${e.caminho}: ${e.mensagem}`);
        await restaurar();
        process.exit(1);
      }
      for (const a of validacao.avisos ?? []) console.log(`Aviso: ${a.caminho}: ${a.mensagem}`);
      const publicado = await chamar('POST', `/questionarios/${atual.id}/publicar`, { versao, confirmarAvisos: true });
      atual = publicado;
      console.log(`Publicada a versão ${publicado.versaoPublicada}. Quem já se inscreveu segue na versão que respondeu.`);
    } catch (e) {
      await restaurar().catch(() => { /* o erro original é o que importa */ });
      throw e;
    }
  }
  if (precisaPadrao) {
    await chamar('POST', `/questionarios/${atual.id}/padrao`);
    console.log('Definido como o padrão da inscrição.');
  }

  // 2. Link: só o texto e os campos escondidos; ligado/desligado e responsável voltam como estavam.
  let versaoDoLink = config.versao ?? null;
  if (plano.texto) {
    const salvo = await chamar('PUT', '/inscricoes/configuracao', {
      aberta: plano.aberta, responsavelId: plano.responsavelId, texto: TEXTO_DO_LINK, versao: versaoDoLink,
    });
    versaoDoLink = salvo.versao;
    console.log('Texto de apresentação do link trocado.');
  }
  if (plano.campos) {
    await chamar('PUT', '/inscricoes/configuracao/campos-ocultos', { camposOcultos: CAMPOS_ESCONDIDOS, versao: versaoDoLink });
    console.log(`Campos fixos escondidos: ${CAMPOS_ESCONDIDOS.join(', ')}.`);
  }
}

principal().catch((e) => sair(e.message));
