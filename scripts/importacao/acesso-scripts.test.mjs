// Os scripts de importação rodando de verdade contra uma API de mentira em 127.0.0.1 (sem rede, dados fictícios):
// https obrigatório, código MFA no login, GET /eu antes de gravar e e-mail sem padrão. node --test scripts/importacao/
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const ALUNOS = join(AQUI, 'importar-alunos.mjs');
const CONTEUDO = join(AQUI, 'importar.mjs');
const ANAMNESE = join(AQUI, '..', 'questionario', 'anamnese-saraiva.mjs');

const TODAS_DE_ALUNO = ['ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR'];
let permissoes = TODAS_DE_ALUNO;
let chamadas = [];
let servidor;
let base;
let pasta;

before(async () => {
  servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      chamadas.push({ metodo: req.method, caminho: req.url.split('?')[0], corpo: corpo ? JSON.parse(corpo) : null });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/auth/login') return res.end(JSON.stringify({ accessToken: 'token-de-teste' }));
      if (req.url === '/eu') return res.end(JSON.stringify({ permissoes }));
      if (req.url.startsWith('/alunos?')) return res.end(JSON.stringify({ itens: [], total: 0 }));
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
  pasta = mkdtempSync(join(tmpdir(), 'importacao-teste-'));
  for (const n of ['alunos.csv', 'pesos.csv']) copyFileSync(join(AQUI, 'modelos', n), join(pasta, n));
  mkdirSync(join(pasta, 'vazia'));
});

after(async () => {
  await new Promise((ok) => servidor.close(ok));
  rmSync(pasta, { recursive: true, force: true });
});

/** Roda um script com um ambiente limpo (nada do ambiente real do PC chega nele). */
function rodar(script, args, env) {
  const limpo = { ...process.env };
  for (const k of ['API_URL', 'IMPORT_EMAIL', 'IMPORT_SENHA', 'IMPORT_PERMITIR_HTTP', 'DEMO_SENHA', 'CODIGO_MFA', 'ANAMNESE_EMAIL', 'ANAMNESE_SENHA']) delete limpo[k];
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { env: { ...limpo, ...env }, timeout: 30000 }, (erro, stdout, stderr) => {
      resolve({ codigo: erro ? erro.code : 0, saida: `${stdout}${stderr}` });
    });
  });
}

const login = () => chamadas.find((c) => c.caminho === '/auth/login');
const escritas = () => chamadas.filter((c) => c.metodo !== 'GET' && c.caminho !== '/auth/login');

test('os quatro scripts recusam API_URL em http fora da máquina local, sem abrir conexão nem pedir a senha', async () => {
  chamadas = [];
  const env = { API_URL: 'http://consultoria.exemplo.com/api', IMPORT_EMAIL: 'a@b.c', IMPORT_SENHA: 'senha-de-teste', ANAMNESE_EMAIL: 'a@b.c', ANAMNESE_SENHA: 'senha-de-teste' };
  for (const [script, args] of [[ALUNOS, ['--pasta', pasta, '--simular']], [CONTEUDO, ['--simular']], [ANAMNESE, []], [join(AQUI, 'importar-planos.mjs'), ['--pasta', pasta, '--simular']]]) {
    const r = await rodar(script, args, env);
    assert.equal(r.codigo, 1, script);
    assert.match(r.saida, /API_URL precisa ser https/, script);
    assert.ok(!r.saida.includes('senha-de-teste'), script);
  }
  assert.deepEqual(chamadas, []);
});

test('importar-alunos: o login leva o código MFA do ambiente e o GET /eu vem antes de qualquer escrita', async () => {
  chamadas = [];
  permissoes = TODAS_DE_ALUNO;
  const r = await rodar(ALUNOS, ['--pasta', pasta, '--simular'], { API_URL: base, IMPORT_EMAIL: 'treinador@exemplo.com', IMPORT_SENHA: 'senha-de-teste', CODIGO_MFA: '123456' });
  assert.equal(r.codigo, 0, r.saida);
  assert.deepEqual(login().corpo, { email: 'treinador@exemplo.com', senha: 'senha-de-teste', codigoMfa: '123456' });
  assert.deepEqual(chamadas.map((c) => c.caminho).slice(0, 2), ['/auth/login', '/eu']);
  assert.ok(!r.saida.includes('ATENÇÃO'));
});

test('importar-alunos: sem CODIGO_MFA o login não leva o campo', async () => {
  chamadas = [];
  await rodar(ALUNOS, ['--pasta', pasta, '--simular'], { API_URL: base, IMPORT_EMAIL: 'treinador@exemplo.com', IMPORT_SENHA: 'senha-de-teste' });
  assert.deepEqual(login().corpo, { email: 'treinador@exemplo.com', senha: 'senha-de-teste' });
});

test('importar-alunos: login sem a permissão do peso não grava nada; na simulação só avisa', async () => {
  permissoes = ['ALUNO_LER', 'ALUNO_ALTERAR'];
  chamadas = [];
  const env = { API_URL: base, IMPORT_EMAIL: 'treinador@exemplo.com', IMPORT_SENHA: 'senha-de-teste' };
  const gravar = await rodar(ALUNOS, ['--pasta', pasta], env);
  assert.equal(gravar.codigo, 1);
  assert.match(gravar.saida, /Faltam permissões para este login: ALUNO_SENSIVEL_LER, ALUNO_SENSIVEL_ALTERAR\. Nada foi gravado\./);
  assert.deepEqual(escritas(), []);
  assert.ok(!chamadas.some((c) => c.caminho === '/alunos'), 'nem a listagem foi chamada');

  chamadas = [];
  const simular = await rodar(ALUNOS, ['--pasta', pasta, '--simular'], env);
  assert.equal(simular.codigo, 0, simular.saida);
  assert.match(simular.saida, /ATENÇÃO: este login não poderia gravar; faltam as permissões ALUNO_SENSIVEL_LER, ALUNO_SENSIVEL_ALTERAR\./);
  assert.deepEqual(escritas(), []);
  permissoes = TODAS_DE_ALUNO;
});

test('importar.mjs: sem IMPORT_EMAIL o script para antes de qualquer chamada, mesmo com a senha da demo', async () => {
  chamadas = [];
  const r = await rodar(CONTEUDO, ['--simular'], { API_URL: base, DEMO_SENHA: 'senha-de-teste' });
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /Defina IMPORT_EMAIL/);
  assert.deepEqual(chamadas, []);
});

test('importar.mjs: login sem permissão de biblioteca e modelos para antes de ler ou gravar; com MFA no login', async () => {
  chamadas = [];
  permissoes = ['BIBLIOTECA_LER'];
  const r = await rodar(CONTEUDO, [], { API_URL: base, IMPORT_EMAIL: 'treinador@exemplo.com', IMPORT_SENHA: 'senha-de-teste', CODIGO_MFA: '654321' });
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /Faltam permissões para este login: BIBLIOTECA_ALTERAR, MODELO_LER, MODELO_ALTERAR\. Nada foi gravado\./);
  assert.equal(login().corpo.codigoMfa, '654321');
  assert.deepEqual(chamadas.map((c) => c.caminho), ['/auth/login', '/eu']);
  permissoes = TODAS_DE_ALUNO;
});

test('importar.mjs: ERGOGENICO_ALTERAR só é exigida de quem lê ergogênicos', async () => {
  const env = { API_URL: base, IMPORT_EMAIL: 'treinador@exemplo.com', IMPORT_SENHA: 'senha-de-teste' };
  const base4 = ['BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'];

  chamadas = [];
  permissoes = [...base4, 'ERGOGENICO_LER'];
  const comLer = await rodar(CONTEUDO, [], env);
  assert.equal(comLer.codigo, 1);
  assert.match(comLer.saida, /Faltam permissões para este login: ERGOGENICO_ALTERAR\./);
  assert.deepEqual(escritas(), []);

  // sem ERGOGENICO_LER a etapa é pulada (como na demo), então a conferência passa e a importação segue até a 1ª leitura
  chamadas = [];
  permissoes = base4;
  await rodar(CONTEUDO, [], env);
  assert.ok(chamadas.some((c) => c.caminho === '/receitas'), 'passou da conferência');
  permissoes = TODAS_DE_ALUNO;
});

test('anamnese: o login leva o código MFA e o endereço http local continua valendo', async () => {
  chamadas = [];
  permissoes = [];
  await rodar(ANAMNESE, [], { API_URL: base, ANAMNESE_EMAIL: 'treinador@exemplo.com', ANAMNESE_SENHA: 'senha-de-teste', CODIGO_MFA: '111222' });
  assert.deepEqual(login().corpo, { email: 'treinador@exemplo.com', senha: 'senha-de-teste', codigoMfa: '111222' });
  permissoes = TODAS_DE_ALUNO;
});
