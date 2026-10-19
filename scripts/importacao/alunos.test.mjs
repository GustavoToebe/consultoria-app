// Regras do importador de alunos e pesos, só com dados fictícios: node --test scripts/importacao/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { campos, dataIso, lerCsv, pesoKg, planejar } from './alunos-lib.mjs';

const csv = (linhas) => lerCsv(linhas.join('\n'));
const HOJE = '2026-10-19';

test('o modelo da pasta modelos/ passa na conferência', () => {
  const ler = (n) => lerCsv(readFileSync(new URL(`./modelos/${n}`, import.meta.url), 'utf8'));
  const plano = planejar(ler('alunos.csv'), ler('pesos.csv'), new Map(), HOJE);
  assert.deepEqual(plano.erros, []);
  assert.equal(plano.alunos.length, 2);
  assert.deepEqual(plano.pesos.map((p) => [p.codigo, p.data, p.pesoKg]), [['A1', '2026-06-05', 82.4], ['A1', '2026-06-20', 81.9], ['A2', '2026-06-10', 64]]);
});

test('campos com aspas, vírgula e separador dentro', () => {
  assert.deepEqual(campos('a;"b;c";"d ""e"""', ';'), ['a', 'b;c', 'd "e"']);
  assert.deepEqual(lerCsv('Código,Nome,Peso (kg)\n1,"Fulano, Exemplo",80').linhas[0], { n: 2, codigo: '1', nome: 'Fulano, Exemplo', peso_kg: '80' });
});

test('data em dois formatos; data que não existe não vira outra; o ano nunca é corrigido', () => {
  assert.equal(dataIso('5/6/2025'), '2025-06-05');
  assert.equal(dataIso('2026-06-05'), '2026-06-05');
  assert.equal(dataIso('31/02/2026'), null);
  assert.equal(dataIso('05/06/26'), null);
  assert.equal(dataIso('#REF!'), null);
});

test('peso: vírgula ou ponto; vazio, zero, texto ou absurdo nunca vira número', () => {
  assert.equal(pesoKg('82,5'), 82.5);
  assert.equal(pesoKg('82.5 kg'), 82.5);
  for (const t of ['', '0', 'abc', '600', '-3', '#VALUE!', '1.234']) assert.equal(pesoKg(t), null, t);
});

test('erros citam linha e campo, nunca o valor', () => {
  const alunos = csv(['codigo;nome;email;dias_atualizacao', 'A1;Fulano Exemplo;nao-e-email;400', 'A1;Outro;;', ';Sem Código;;']);
  const pesos = csv(['codigo;data;peso_kg', 'A9;01/01/2026;80', 'A1;31/02/2026;80', 'A1;01/01/2027;80', 'A1;01/01/2026;zero']);
  const { erros } = planejar(alunos, pesos, new Map(), HOJE);
  assert.deepEqual(erros, [
    'alunos.csv linha 2: e-mail inválido.',
    'alunos.csv linha 2: dias de atualização precisa ser de 1 a 365 (ou vazio).',
    'alunos.csv linha 3: código repetido (já na linha 2).',
    'alunos.csv linha 4: código vazio.',
    'pesos.csv linha 2: código sem aluno em alunos.csv.',
    'pesos.csv linha 3: data inválida (use DD/MM/AAAA).',
    'pesos.csv linha 4: data no futuro.',
    'pesos.csv linha 5: peso inválido (número maior que 0 e menor que 500).',
  ]);
  assert.ok(erros.every((e) => !e.includes('Fulano') && !e.includes('nao-e-email')));
});

test('aluno que já existe (mesmo nome, sem acento e caixa) é reaproveitado; nome repetido na planilha é erro', () => {
  const alunos = csv(['codigo;nome', 'A1;José Exemplo', 'A2;Maria Exemplo']);
  const pesos = csv(['codigo;data;peso_kg', 'A1;01/01/2026;80', 'A1;01/01/2026;81']);
  const plano = planejar(alunos, pesos, new Map([['jose exemplo', 'id-existente']]), HOJE);
  assert.equal(plano.alunos[0].idExistente, 'id-existente');
  assert.equal(plano.alunos[1].idExistente, null);
  assert.deepEqual(plano.erros, ['pesos.csv linha 3: mesmo aluno e data da linha 2.']);
  const repetido = planejar(csv(['codigo;nome', 'A1;Ana Exemplo', 'A2;ana  exemplo']), csv(['codigo;data;peso_kg']), new Map(), HOJE);
  assert.deepEqual(repetido.erros, ['alunos.csv linha 3: mesmo nome da linha 2.']);
});

test('coluna obrigatória faltando para tudo', () => {
  const plano = planejar(csv(['codigo;email', 'A1;a@example.com']), csv(['codigo;data', 'A1;01/01/2026']), new Map(), HOJE);
  assert.deepEqual(plano.erros, ['alunos.csv: falta a coluna "nome".', 'pesos.csv: falta a coluna "peso_kg".']);
});
