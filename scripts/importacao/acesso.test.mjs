// Regras de acesso dos scripts de importação, sem rede: node --test scripts/importacao/
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baseDaApi, corpoDoLogin, permissoesQueFaltam } from './acesso-lib.mjs';

const SEM_ENV = {};

test('https passa e a barra final sai', () => {
  assert.equal(baseDaApi('https://consultoria.servirea.com.br/api', SEM_ENV), 'https://consultoria.servirea.com.br/api');
  assert.equal(baseDaApi('https://consultoria.servirea.com.br/api/', SEM_ENV), 'https://consultoria.servirea.com.br/api');
});

test('http só na própria máquina: localhost e 127.0.0.1, com qualquer porta', () => {
  assert.equal(baseDaApi('http://localhost:8088/api', SEM_ENV), 'http://localhost:8088/api');
  assert.equal(baseDaApi('http://127.0.0.1:8080', SEM_ENV), 'http://127.0.0.1:8080');
  assert.equal(baseDaApi('https://localhost:8443/api', SEM_ENV), 'https://localhost:8443/api');
});

test('http para outro host é recusado, inclusive quando o nome só parece local', () => {
  for (const url of [
    'http://consultoria.servirea.com.br/api',
    'http://api:8080',
    'http://localhost.exemplo.com/api',
    'http://127.0.0.1.exemplo.com/api',
    'http://localhost@exemplo.com/api',
    'http://exemplo.com/localhost',
    'http://10.0.0.5:8080',
  ]) {
    assert.throws(() => baseDaApi(url, SEM_ENV), /https|usuário|inválida/, url);
  }
});

test('endereço que não é URL, outro protocolo ou com credencial é recusado', () => {
  for (const url of ['', 'consultoria.servirea.com.br/api', 'ftp://localhost/api', 'https://usuario:senha@exemplo.com/api']) {
    assert.throws(() => baseDaApi(url, SEM_ENV), Error, url);
  }
});

test('a recusa não repete o endereço (ele pode ter credencial)', () => {
  assert.throws(() => baseDaApi('https://usuario:segredo123@exemplo.com/api', SEM_ENV), (e) => !e.message.includes('segredo123'));
});

test('IMPORT_PERMITIR_HTTP=sim libera o http da rede do compose; qualquer outro valor não', () => {
  assert.equal(baseDaApi('http://api:8080', { IMPORT_PERMITIR_HTTP: 'sim' }), 'http://api:8080');
  assert.throws(() => baseDaApi('http://api:8080', { IMPORT_PERMITIR_HTTP: 'true' }), /https/);
  assert.throws(() => baseDaApi('http://api:8080', { IMPORT_PERMITIR_HTTP: '' }), /https/);
  // a liberação não aceita endereço com credencial nem protocolo estranho
  assert.throws(() => baseDaApi('http://u:s@api:8080', { IMPORT_PERMITIR_HTTP: 'sim' }), /usuário/);
  assert.throws(() => baseDaApi('ftp://api', { IMPORT_PERMITIR_HTTP: 'sim' }), /https/);
});

test('o login leva codigoMfa só quando CODIGO_MFA existe', () => {
  assert.deepEqual(corpoDoLogin('a@b.c', 'senha', SEM_ENV), { email: 'a@b.c', senha: 'senha' });
  assert.deepEqual(corpoDoLogin('a@b.c', 'senha', { CODIGO_MFA: '' }), { email: 'a@b.c', senha: 'senha' });
  assert.deepEqual(corpoDoLogin('a@b.c', 'senha', { CODIGO_MFA: '123456' }), { email: 'a@b.c', senha: 'senha', codigoMfa: '123456' });
});

test('permissões que faltam, e resposta sem a lista conta tudo como faltando', () => {
  assert.deepEqual(permissoesQueFaltam({ permissoes: ['A', 'B'] }, ['A', 'C']), ['C']);
  assert.deepEqual(permissoesQueFaltam({ permissoes: ['A'] }, new Set(['A'])), []);
  assert.deepEqual(permissoesQueFaltam({}, ['A']), ['A']);
  assert.deepEqual(permissoesQueFaltam(null, ['A']), ['A']);
});
