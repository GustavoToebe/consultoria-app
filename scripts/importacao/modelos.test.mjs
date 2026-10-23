import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { arquivos } from './gerar-modelos.mjs';

const pasta = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public', 'modelos', 'importacao');

test('os 12 modelos versionados são o que o script gera', () => {
  const gerados = arquivos();
  const nomes = Object.keys(gerados).sort();
  assert.deepEqual(nomes, [
    'alimentos.csv', 'alimentos.xlsx', 'alunos.csv', 'alunos.xlsx', 'exercicios.csv', 'exercicios.xlsx',
    'outros.csv', 'outros.xlsx', 'pesos.csv', 'pesos.xlsx', 'suplementos.csv', 'suplementos.xlsx',
  ]);
  assert.deepEqual(readdirSync(pasta).sort(), nomes);
  for (const nome of nomes) {
    assert.deepEqual(readFileSync(join(pasta, nome)), gerados[nome], nome);
  }
});
