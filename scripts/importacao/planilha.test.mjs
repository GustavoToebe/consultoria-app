// Conversor da planilha do treinador, só com dados fictícios montados aqui: node --test scripts/importacao/planilha.test.mjs
// A planilha de verdade nunca entra no repositório; os .xlsx destes testes são gerados na memória (e, no teste da linha
// de comando, numa pasta temporária fora do repositório, apagada no fim).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

import { lerCsv, planejar } from './alunos-lib.mjs';
import { arquivosCsv, converter, dataDoExcel, lerXlsx, lerZip, resumo, textoXml } from './planilha-lib.mjs';

const HOJE = '2026-10-19';
const CONVERSOR = fileURLToPath(new URL('./converter-planilha.mjs', import.meta.url));

// ---------- gerador mínimo de .xlsx (zip + XML), só para os testes ----------

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Zip com cada membro comprimido (deflate) ou guardado (`guardar`), como o Excel e outros programas gravam. */
function zip(membros, guardar = []) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const [nome, texto] of Object.entries(membros)) {
    const dados = Buffer.from(texto, 'utf8');
    const metodo = guardar.includes(nome) ? 0 : 8;
    const comprimido = metodo === 0 ? dados : deflateRawSync(dados);
    const n = Buffer.from(nome, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc32(dados), 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc32(dados), 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    locais.push(local, n, comprimido);
    centrais.push(central, n);
    deslocamento += 30 + n.length + comprimido.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(centrais.length / 2, 8);
  fim.writeUInt16LE(centrais.length / 2, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const letra = (i) => (i < 26 ? String.fromCharCode(65 + i) : letra(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

/** Série do Excel de uma data `AAAA-MM-DD` (o contrário de `dataDoExcel`). */
const serie = (iso) => (Date.UTC(...iso.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0))) - Date.UTC(1899, 11, 30)) / 86400000;

/**
 * Monta um .xlsx com as abas dadas: `{ nome: [linha, ...] }`, cada linha um array de células. Célula: texto (vai para
 * os textos compartilhados), número, `null` (vazia), `{ inline }`, `{ erro }` ou `{ data: 'AAAA-MM-DD' }` (número do
 * Excel, como o Excel grava uma data). `linhaInicial` numera a primeira linha (para testar título acima do cabeçalho).
 */
function xlsx(abas, { linhaInicial = 1 } = {}) {
  const compartilhados = [];
  const indice = (t) => {
    const i = compartilhados.indexOf(t);
    return i >= 0 ? i : compartilhados.push(t) - 1;
  };
  const folhas = Object.values(abas).map((linhas) => {
    const rows = linhas.map((celulas, i) => {
      const r = linhaInicial + i;
      const cs = celulas
        .map((v, c) => {
          const ref = `${letra(c)}${r}`;
          if (v === null || v === undefined) return '';
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
          if (typeof v === 'string') return `<c r="${ref}" t="s"><v>${indice(v)}</v></c>`;
          if ('inline' in v) return `<c r="${ref}" t="inlineStr"><is><t>${esc(v.inline)}</t></is></c>`;
          if ('erro' in v) return `<c r="${ref}" t="e"><v>${esc(v.erro)}</v></c>`;
          return `<c r="${ref}" s="1"><v>${serie(v.data)}</v></c>`;
        })
        .join('');
      return `<row r="${r}">${cs}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
  });
  const nomes = Object.keys(abas);
  return zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      nomes.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      '</Relationships>',
    'xl/sharedStrings.xml':
      `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${compartilhados.length}">` +
      compartilhados.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join('') +
      '</sst>',
    ...Object.fromEntries(folhas.map((f, i) => [`xl/worksheets/sheet${i + 1}.xml`, f])),
  }, ['xl/workbook.xml']);
}

const CAB_ALUNOS = ['ID', 'Nome', 'Email', 'Telefone', 'Peso Inicial (kg)', 'Objetivo', 'Data Início', 'Status', 'Obs'];
const CAB_PESOS = ['ID', 'ID Aluno', 'Nome Aluno', 'Data', 'Semana Nº', 'Peso (kg)', 'Variação (kg)', 'Observação'];

/** A planilha fictícia "completa": três alunos, um inativo, e as linhas problemáticas que a de verdade tem. */
function planilhaFicticia() {
  return xlsx({
    Resumo: [['Planilha fictícia de teste']],
    Alunos: [
      CAB_ALUNOS,
      ['ALU001', 'Aluno  Teste 1', ' Aluno.Teste1@Example.com ', '(45) 90000-0001', 80.5, 'Objetivo fictício', { data: '2026-01-05' }, 'Ativo', 'Obs fictícia'],
      ['ALU002', 'Aluna Teste 2', 'nao-e-email', null, '64,2', null, { data: '2026-02-01' }, 'Inativo', null],
      ['ALU003', { inline: 'Aluno Teste 3' }, null, null, null, null, null, 'ativa', null],
      [null, 'Aluno Teste Sem Id', null, null, null, null, null, 'Ativo', null],
      [],
      ['ALU001', 'Aluno Teste Repetido', null, null, null, null, null, null, null],
      ['ALU004', 'Aluno Teste 4', null, null, 70, null, null, 'Ativo', null],
      ['ALU005', null, null, null, null, null, null, null, null],
    ],
    'Histórico Pesos': [
      CAB_PESOS,
      ['P1', 'ALU001', 'Aluno Teste 1', { data: '2026-01-05' }, 1, 80.5, null, null],
      ['P2', 'ALU001', 'Aluno Teste 1', { data: '2026-01-12' }, 2, 79.9000000001, -0.6, 'Observação; fictícia'],
      ['P3', 'ALU001', 'Aluno Teste 1', null, 3, 79.5, null, null],
      ['P4', 'ALU001', 'Aluno Teste 1', { data: '2099-01-01' }, 4, 79, null, null],
      ['P5', 'ALU002', 'Aluna Teste 2', { data: '2026-02-08' }, 1, { erro: '#REF!' }, null, null],
      ['P6', 'ALU009', 'Aluno Teste 9', { data: '2026-02-08' }, 1, 90, null, null],
      ['P7', null, 'Aluno Teste 1', { data: '2026-02-08' }, 1, 90, null, null],
      ['P8', 'ALU002', 'Aluna Teste 2', '15/02/2026', 2, '63,8', null, null],
      ['P9', 'ALU001', 'Aluno Teste 1', { data: '2026-01-12' }, 2, 79.8, null, null],
      ['P10', 'ALU005', 'Aluno Teste 5', { data: '2026-02-08' }, 1, 70, null, null],
      ['P11', 'ALU003', 'Aluno Teste 3', { data: '2026-03-01' }, 1, 81.955, null, null],
      ['P12', 'ALU003', 'Aluno Teste 3', 'ontem', 1, 81, null, null],
    ],
  });
}

// ---------- testes ----------

test('data do Excel: dias desde 30/12/1899 (ou 1904), hora descartada, série impossível recusada', () => {
  assert.equal(dataDoExcel(45000), '2023-03-15');
  assert.equal(dataDoExcel(45000.75), '2023-03-15');
  assert.equal(dataDoExcel(serie('2026-10-19')), '2026-10-19');
  assert.equal(dataDoExcel(0, true), '1904-01-01');
  for (const s of [0, 60, -1, Number.NaN, 3e6]) assert.equal(dataDoExcel(s), null, String(s));
});

test('texto do XML: entidades e o escape _xHHHH_ do Office', () => {
  assert.equal(textoXml('a &amp; b &lt;c&gt; &#233; &#xE7; &quot;x&quot;'), 'a & b <c> é ç "x"');
  assert.equal(textoXml('linha_x000D_'), 'linha\r');
});

test('lê abas, textos compartilhados e na célula, números, erros e células puladas', () => {
  const p = lerXlsx(xlsx({ Um: [['a & b', null, 3.5], [{ inline: 'só na célula' }, { erro: '#N/A' }]], Dois: [[1]] }));
  assert.deepEqual([...p.abas.keys()], ['Um', 'Dois']);
  const [l1, l2] = p.abas.get('Um');
  assert.equal(l1.n, 1);
  assert.deepEqual(l1.celulas[0], { tipo: 'texto', valor: 'a & b' });
  assert.equal(l1.celulas[1], undefined);
  assert.deepEqual(l1.celulas[2], { tipo: 'numero', valor: 3.5 });
  assert.deepEqual(l2.celulas, [{ tipo: 'texto', valor: 'só na célula' }, { tipo: 'erro', valor: '#N/A' }]);
  assert.equal(p.data1904, false);
});

test('texto com formatação por trecho e sistema de datas de 1904', () => {
  const membros = {
    'xl/workbook.xml': '<x:workbook xmlns:x="m" xmlns:r="r"><x:workbookPr date1904="1"/><x:sheets><x:sheet name="A" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/folha.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><r><t>Alu</t></r><r><rPr><b/></rPr><t>no</t></r><rPh><t>x</t></rPh></si></sst>',
    'xl/worksheets/folha.xml': '<x:worksheet><x:sheetData><x:row><x:c t="s"><x:v>0</x:v></x:c><x:c><x:v>0</x:v></x:c></x:row></x:sheetData></x:worksheet>',
  };
  const p = lerXlsx(zip(membros));
  assert.equal(p.data1904, true);
  assert.deepEqual(p.abas.get('A')[0], { n: 1, celulas: [{ tipo: 'texto', valor: 'Aluno' }, { tipo: 'numero', valor: 0 }] });
});

test('arquivo que não é xlsx ou zip corrompido: erro sem conteúdo', () => {
  assert.throws(() => lerXlsx(Buffer.from('nome;peso\nFulano;80')), /não é um \.xlsx/);
  const bom = xlsx({ Alunos: [['x']] });
  // O workbook.xml vai guardado (sem compressão): trocar um byte dele só o CRC pega.
  const estragado = Buffer.from(bom);
  estragado[estragado.indexOf('xl/workbook.xml') + 'xl/workbook.xml'.length + 5] ^= 0x01;
  assert.throws(() => lerXlsx(estragado), /corrompido \(conteúdo do zip\)/);
  assert.equal(lerZip(bom).ler('nao/existe.xml'), null);
});

test('converte a planilha fictícia: alunos, pesos, peso inicial e problemas', () => {
  const r = converter(lerXlsx(planilhaFicticia()), HOJE);
  assert.deepEqual(r.alunos.map((a) => [a.codigo, a.nome, a.email]), [
    ['ALU001', 'Aluno Teste 1', 'aluno.teste1@example.com'],
    ['ALU002', 'Aluna Teste 2', ''],
    ['ALU003', 'Aluno Teste 3', ''],
    ['ALU004', 'Aluno Teste 4', ''],
  ]);
  assert.deepEqual(r.pesos.map((p) => [p.codigo, p.data, p.pesoKg, p.observacao]), [
    ['ALU001', '2026-01-05', 80.5, ''],
    ['ALU001', '2026-01-12', 79.9, 'Observação; fictícia'],
    ['ALU002', '2026-02-01', 64.2, ''],
    ['ALU002', '2026-02-15', 63.8, ''],
  ]);
  assert.deepEqual(r.contagens, { alunos: 4, inativos: 1, pesos: 4, pesosIniciais: 1, iniciaisNoHistorico: 1 });
  assert.deepEqual(r.problemas.map((p) => `${p.aba} ${p.linha}: ${p.motivo}`), [
    'Alunos 3: e-mail inválido (aluno convertido sem e-mail)',
    'Alunos 5: aluno sem ID',
    'Alunos 7: ID repetido (já na linha 2)',
    'Alunos 8: peso inicial sem data de início',
    'Alunos 9: aluno sem nome',
    'Histórico Pesos 4: sem data',
    'Histórico Pesos 5: data no futuro',
    'Histórico Pesos 6: peso inválido',
    'Histórico Pesos 7: ID do aluno não está na aba Alunos',
    'Histórico Pesos 8: peso sem ID do aluno',
    'Histórico Pesos 10: mesmo aluno e data (linha 3)',
    'Histórico Pesos 11: aluno ficou fora da conversão (aba Alunos, linha 9)',
    'Histórico Pesos 12: peso inválido',
    'Histórico Pesos 13: data inválida',
  ]);
});

test('o que sai passa na conferência do importador, e problemas e resumo não levam dado de aluno', () => {
  const r = converter(lerXlsx(planilhaFicticia()), HOJE);
  const arquivos = arquivosCsv(r);
  assert.equal(arquivos['alunos.csv'].split('\n')[0], 'codigo;nome;email;dias_atualizacao');
  assert.equal(arquivos['pesos.csv'].split('\n')[0], 'codigo;data;peso_kg;observacao');
  assert.ok(arquivos['pesos.csv'].includes('ALU001;12/01/2026;79,9;"Observação; fictícia"'));
  assert.ok(arquivos['alunos.csv'].includes('ALU001;Aluno Teste 1;aluno.teste1@example.com;\n'));
  const plano = planejar(lerCsv(arquivos['alunos.csv']), lerCsv(arquivos['pesos.csv']), new Map(), HOJE);
  assert.deepEqual(plano.erros, []);
  assert.equal(plano.alunos.length, 4);
  assert.equal(plano.pesos.length, 4);

  const semDado = [arquivos['problemas.csv'], ...resumo(r)].join('\n');
  for (const proibido of ['Aluno Teste', 'Aluna Teste', 'example.com', 'nao-e-email', '80,5', '80.5', '79,9', 'fictícia', '(45)']) {
    assert.ok(!semDado.includes(proibido), proibido);
  }
  assert.equal(arquivos['problemas.csv'].split('\n')[0], 'aba;linha;motivo');
});

test('primeira célula do cabeçalho com um ID no lugar de "ID", título acima e aba com outro nome de caixa', () => {
  const r = converter(
    lerXlsx(
      xlsx(
        {
          ALUNOS: [['Cadastro (fictício)'], [], ['ALU000', 'Nome', 'Email', 'Status'], ['ALU010', 'Aluno Teste 10', null, 'Pausado']],
          'historico pesos': [['ALU000', 'ID Aluno', 'Data', 'Peso (kg)'], ['P1', 'ALU010', { data: '2026-05-01' }, 70]],
        },
        { linhaInicial: 3 },
      ),
    ),
    HOJE,
  );
  assert.deepEqual(r.alunos.map((a) => a.codigo), ['ALU010']);
  assert.equal(r.pesos.length, 1);
  assert.equal(r.contagens.inativos, 1);
  assert.deepEqual(r.problemas, []);
});

test('nome repetido é anotado e mantido (o importador para); peso inicial na mesma data do histórico não duplica', () => {
  const r = converter(
    lerXlsx(
      xlsx({
        Alunos: [CAB_ALUNOS, ['A1', 'Aluno Teste', null, null, 80, null, { data: '2026-01-01' }], ['A2', 'aluno  teste', null, null, null, null, null]],
        'Histórico Pesos': [CAB_PESOS, ['P1', 'A1', null, { data: '2026-01-01' }, 1, 79]],
      }),
    ),
    HOJE,
  );
  assert.equal(r.alunos.length, 2);
  assert.deepEqual(r.problemas.map((p) => p.motivo), ['mesmo nome de outro aluno (linha 2; o importador para até corrigir)']);
  assert.deepEqual(r.pesos.map((p) => p.pesoKg), [79]);
  assert.equal(r.contagens.iniciaisNoHistorico, 1);
});

test('aba ou cabeçalho que falta para tudo, com mensagem sem conteúdo da planilha', () => {
  assert.throws(() => converter(lerXlsx(xlsx({ Alunos: [CAB_ALUNOS] })), HOJE), /não achei a aba "Histórico Pesos"/);
  assert.throws(
    () => converter(lerXlsx(xlsx({ Alunos: [['Fulano Teste']], 'Histórico Pesos': [CAB_PESOS] })), HOJE),
    (e) => /aba "Alunos": não achei o cabeçalho/.test(e.message) && !e.message.includes('Fulano'),
  );
});

test('linha de comando: recusa planilha ou saída no repositório e grava os três arquivos fora dele', (t) => {
  const pasta = mkdtempSync(join(tmpdir(), 'conversor-teste-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  const arquivo = join(pasta, 'planilha.xlsx');
  writeFileSync(arquivo, planilhaFicticia());
  const rodar = (...args) => spawnSync(process.execPath, [CONVERSOR, ...args], { encoding: 'utf8' });

  const dentro = rodar('--planilha', fileURLToPath(new URL('./x.xlsx', import.meta.url)), '--saida', join(pasta, 'saida'));
  assert.equal(dentro.status, 1);
  assert.match(dentro.stderr, /planilha está dentro do repositório/);
  const saidaDentro = rodar('--planilha', arquivo, '--saida', fileURLToPath(new URL('./saida-teste', import.meta.url)));
  assert.equal(saidaDentro.status, 1);
  assert.match(saidaDentro.stderr, /saída está dentro do repositório/);

  const ok = rodar('--planilha', arquivo, '--saida', join(pasta, 'saida'));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Convertido: 4 alunos \(1 não ativos/);
  assert.match(ok.stdout, /Problemas: 14 linha/);
  assert.ok(!/Aluno Teste|example\.com|80[,.]5/.test(ok.stdout + ok.stderr));
  const ler = (n) => readFileSync(join(pasta, 'saida', n), 'utf8');
  assert.equal(ler('problemas.csv').trim().split('\n').length, 15);
  assert.deepEqual(planejar(lerCsv(ler('alunos.csv')), lerCsv(ler('pesos.csv')), new Map(), HOJE).erros, []);

  const naoXlsx = join(pasta, 'texto.xlsx');
  writeFileSync(naoXlsx, 'não é planilha');
  const ruim = rodar('--planilha', naoXlsx, '--saida', join(pasta, 'outra'));
  assert.equal(ruim.status, 1);
  assert.match(ruim.stderr, /Planilha não convertida/);
});

// Confere a leitura contra um .xlsx gravado por outro programa (openpyxl), quando ele existe nesta máquina. Pula sem ele.
const python = spawnSync('python3', ['-I', '-c', 'import openpyxl'], { encoding: 'utf8' });
test('lê um .xlsx gravado pelo openpyxl (datas com estilo, números, textos)', { skip: python.status !== 0 && 'sem python3 + openpyxl' }, (t) => {
  const pasta = mkdtempSync(join(tmpdir(), 'conversor-openpyxl-'));
  t.after(() => rmSync(pasta, { recursive: true, force: true }));
  const arquivo = join(pasta, 'p.xlsx');
  const script = `
import sys, datetime, openpyxl
wb = openpyxl.Workbook()
a = wb.active
a.title = 'Alunos'
a.append(['ID', 'Nome', 'Email', 'Telefone', 'Peso Inicial (kg)', 'Objetivo', 'Data Início', 'Status', 'Obs'])
a.append(['ALU001', 'Aluno Teste 1', 'aluno1@example.com', None, 80.5, None, datetime.datetime(2026, 1, 5), 'Ativo', None])
a.append(['ALU002', 'Aluna Teste Ç', None, None, None, None, None, 'Inativo', None])
h = wb.create_sheet('Histórico Pesos')
h.append(['ID', 'ID Aluno', 'Nome Aluno', 'Data', 'Semana Nº', 'Peso (kg)', 'Variação (kg)', 'Observação'])
h.append(['P1', 'ALU001', 'Aluno Teste 1', datetime.datetime(2026, 1, 12, 7, 30), 1, 79.9, -0.6, 'a & b'])
h.append(['P2', 'ALU002', 'Aluna Teste Ç', datetime.date(2026, 2, 1), 1, 64, None, None])
wb.save(sys.argv[1])
`;
  const gerado = spawnSync('python3', ['-I', '-c', script, arquivo], { encoding: 'utf8' });
  assert.equal(gerado.status, 0, gerado.stderr);
  const r = converter(lerXlsx(readFileSync(arquivo)), HOJE);
  assert.deepEqual(r.alunos.map((a) => [a.codigo, a.nome, a.email]), [['ALU001', 'Aluno Teste 1', 'aluno1@example.com'], ['ALU002', 'Aluna Teste Ç', '']]);
  assert.deepEqual(r.pesos.map((p) => [p.codigo, p.data, p.pesoKg, p.observacao]), [
    ['ALU001', '2026-01-05', 80.5, ''],
    ['ALU001', '2026-01-12', 79.9, 'a & b'],
    ['ALU002', '2026-02-01', 64, ''],
  ]);
  assert.equal(r.contagens.inativos, 1);
  assert.deepEqual(r.problemas, []);
});
