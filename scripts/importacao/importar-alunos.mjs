#!/usr/bin/env node
/**
 * Importa alunos e o histórico de peso de uma planilha (dois CSV no formato de `modelos/`) para uma consultoria, pela
 * API, como um membro com permissão de alunos e de dados sensíveis (o Administrador). Pedido da reunião de 17/10
 * (R25/R26/R51): trazer os alunos com as datas dos pesos, para a curva de evolução já aparecer.
 *
 *   node scripts/importacao/importar-alunos.mjs --pasta C:\caminho\fora\do\repositorio --simular   (só confere)
 *   node scripts/importacao/importar-alunos.mjs --pasta C:\caminho\fora\do\repositorio             (grava)
 *
 * A pasta tem `alunos.csv` e `pesos.csv` e precisa ficar **fora do repositório** (dado de aluno nunca vai para o git);
 * o script recusa uma pasta dentro dele. Qualquer erro na conferência para tudo antes de gravar. Rodar de novo não
 * duplica: aluno com o mesmo nome é reaproveitado e o peso da mesma data é atualizado (a API guarda um por dia). Não
 * manda convite: o acesso de cada aluno sai pela ficha, quando o treinador quiser.
 *
 * Variáveis: API_URL (padrão http://localhost:8088/api; só https, ou http em localhost/127.0.0.1), IMPORT_EMAIL e a senha em
 * IMPORT_SENHA (nunca na linha de comando); CODIGO_MFA, se a conta tem verificação em duas etapas. Antes de gravar, confere as
 * permissões do login em GET /eu. O terminal mostra só contagens e o número da linha com problema, nunca nome, e-mail ou peso.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseDaApiOuSair, corpoDoLogin, permissoesQueFaltam } from './acesso-lib.mjs';
import { chaveDoNome, lerCsv, planejar } from './alunos-lib.mjs';

const REPOSITORIO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIMULAR = process.argv.includes('--simular');
const indicePasta = process.argv.indexOf('--pasta');
const PASTA = indicePasta > 0 ? process.argv[indicePasta + 1] : null;
const BASE = baseDaApiOuSair('http://localhost:8088/api');

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

if (!PASTA) sair('Informe a pasta com alunos.csv e pesos.csv: --pasta <caminho>.');
const pasta = resolve(PASTA);
const dentro = relative(REPOSITORIO, pasta);
if (!dentro.startsWith('..') && !isAbsolute(dentro)) sair('A pasta está dentro do repositório. Use uma pasta fora dele (dado de aluno nunca vai para o git).');

let token = null;
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'X-Treinos-Cliente': 'nativo', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) {
    // Só status e código: a mensagem da API pode repetir o que foi enviado.
    let codigo = '';
    try { codigo = JSON.parse(texto).codigo ?? ''; } catch { /* corpo não é JSON */ }
    throw new Error(`${metodo} ${caminho.replace(/[0-9a-f-]{36}/g, '<id>')} -> ${r.status} ${codigo}`);
  }
  return texto ? JSON.parse(texto) : null;
}

async function entrar() {
  const email = process.env.IMPORT_EMAIL;
  const senha = process.env.IMPORT_SENHA;
  if (!email || !senha) sair('Defina IMPORT_EMAIL e IMPORT_SENHA no ambiente (não na linha de comando).');
  const j = await chamar('POST', '/auth/login', corpoDoLogin(email, senha));
  token = j.accessToken;
  if (!token) sair('Login sem token de acesso.');
}

async function alunosExistentes() {
  const mapa = new Map();
  for (let pagina = 0; ; pagina++) {
    const p = await chamar('GET', `/alunos?situacao=TODOS&tamanho=100&pagina=${pagina}`);
    for (const a of p.itens) {
      const chave = chaveDoNome(a.nome);
      // Dois alunos com o mesmo nome na consultoria: não dá para escolher; a planilha cria um novo e o treinador junta.
      mapa.set(chave, mapa.has(chave) ? null : a.id);
    }
    if ((pagina + 1) * 100 >= p.total || p.itens.length === 0) break;
  }
  for (const [k, v] of mapa) if (v === null) mapa.delete(k);
  return mapa;
}

const ler = (nome) => {
  try {
    return lerCsv(readFileSync(join(pasta, nome), 'utf8'));
  } catch {
    sair(`Não consegui ler ${nome} na pasta informada.`);
  }
};

const alunosCsv = ler('alunos.csv');
const pesosCsv = ler('pesos.csv');
await entrar();
// O peso exige as duas permissões sensíveis (ler e alterar). Sem elas o treinador criaria alunos e pararia no primeiro peso.
const faltam = permissoesQueFaltam(await chamar('GET', '/eu'), ['ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR']);
if (faltam.length && !SIMULAR) sair(`Faltam permissões para este login: ${faltam.join(', ')}. Nada foi gravado.`);
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const plano = planejar(alunosCsv, pesosCsv, await alunosExistentes(), hoje);

if (plano.erros.length) {
  console.error(`Conferência: ${plano.erros.length} problema(s). Nada foi gravado.`);
  for (const e of plano.erros) console.error(`- ${e}`);
  process.exit(1);
}
const novos = plano.alunos.filter((a) => !a.idExistente).length;
console.log(`Conferência ok: ${plano.alunos.length} alunos (${novos} novos, ${plano.alunos.length - novos} já existem) e ${plano.pesos.length} pesos.`);
if (SIMULAR) {
  if (faltam.length) console.log(`ATENÇÃO: este login não poderia gravar; faltam as permissões ${faltam.join(', ')}.`);
  console.log('Simulação: nada foi gravado.');
  process.exit(0);
}

const ids = new Map();
let criados = 0;
for (const a of plano.alunos) {
  if (a.idExistente) {
    ids.set(a.codigo, a.idExistente);
    continue;
  }
  const corpo = { nome: a.nome, email: a.email, diasAtualizacao: a.diasAtualizacao };
  const criado = await chamar('POST', '/alunos', corpo).catch((e) => sair(`alunos.csv linha ${a.n}: ${e.message}`));
  ids.set(a.codigo, criado.id);
  criados++;
}
let gravados = 0;
for (const p of plano.pesos) {
  await chamar('POST', `/alunos/${ids.get(p.codigo)}/pesos`, { data: p.data, pesoKg: p.pesoKg, observacao: p.observacao })
    .catch((e) => sair(`pesos.csv linha ${p.n}: ${e.message} (${criados} alunos e ${gravados} pesos já gravados; rodar de novo continua sem duplicar)`));
  gravados++;
}
console.log(`Gravado: ${criados} alunos novos e ${gravados} pesos.`);
