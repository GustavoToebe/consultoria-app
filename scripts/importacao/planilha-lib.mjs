/**
 * Regras puras do conversor da planilha do treinador (o `.xlsx` com as abas "Alunos" e "Histórico Pesos") para os dois
 * CSV do importador de alunos e pesos (`modelos/`, `alunos-lib.mjs`). Pedido da reunião de 17/10 (R25/R26/R51): o
 * Saraiva tem os alunos e os pesos numa planilha própria, e exportar à mão cada aba para CSV perde as datas do Excel.
 *
 * Sem dependência nova: um `.xlsx` é um zip de XML, e o Node já traz o `inflateRawSync`. A leitura aqui cobre só o que a
 * planilha usa (texto compartilhado, texto na célula, número, data como número do Excel, erro de fórmula); estilos,
 * fórmulas e o resto do arquivo são ignorados. Nada aqui lê arquivo nem escreve no terminal: os testes
 * (`node --test scripts/importacao/`) montam uma planilha fictícia na memória.
 *
 * Linha com problema nunca some calada: vai para a lista de problemas com aba, linha e motivo, nunca com nome, e-mail
 * ou peso (o arquivo de problemas e o terminal não viram lugar de dado de aluno).
 */
import * as zlib from 'node:zlib';

import { chaveDoNome, coluna, dataIso, pesoKg } from './alunos-lib.mjs';

/** Teto de cada arquivo de dentro do zip, já descomprimido: uma planilha de alunos não chega perto; um zip-bomba para aqui. */
const LIMITE_MEMBRO = 64 * 1024 * 1024;

/**
 * Lê o diretório central de um zip e devolve `ler(nome)`, que descomprime um membro (ou devolve null se ele não existe).
 * Só "guardado" (0) e "deflate" (8), sem zip64 nem criptografia: é o que o Excel, o LibreOffice e o Google Planilhas
 * gravam num `.xlsx`. Planilha com senha não é zip (é outro formato) e cai no primeiro erro.
 */
export function lerZip(buf) {
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error('o arquivo não é um .xlsx (se a planilha tem senha, salve uma cópia sem senha).');
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const membros = new Map();
  for (let k = 0; k < total; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('o .xlsx está corrompido (diretório do zip).');
    const n = buf.readUInt16LE(p + 28);
    membros.set(buf.toString('utf8', p + 46, p + 46 + n), {
      flags: buf.readUInt16LE(p + 8),
      metodo: buf.readUInt16LE(p + 10),
      crc: buf.readUInt32LE(p + 16),
      comprimido: buf.readUInt32LE(p + 20),
      tamanho: buf.readUInt32LE(p + 24),
      local: buf.readUInt32LE(p + 42),
    });
    p += 46 + n + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return {
    ler(nome) {
      const m = membros.get(nome);
      if (!m) return null;
      if (m.flags & 1) throw new Error('o .xlsx está criptografado; salve uma cópia sem senha.');
      if (m.comprimido === 0xffffffff || m.tamanho > LIMITE_MEMBRO) throw new Error('o .xlsx é grande demais para o conversor.');
      if (m.local + 30 > buf.length || buf.readUInt32LE(m.local) !== 0x04034b50) throw new Error('o .xlsx está corrompido (cabeçalho do zip).');
      const ini = m.local + 30 + buf.readUInt16LE(m.local + 26) + buf.readUInt16LE(m.local + 28);
      const dados = buf.subarray(ini, ini + m.comprimido);
      let saida;
      if (m.metodo === 0) saida = Buffer.from(dados);
      else if (m.metodo === 8) saida = zlib.inflateRawSync(dados, { maxOutputLength: LIMITE_MEMBRO });
      else throw new Error('o .xlsx usa uma compressão que o conversor não conhece.');
      // O CRC só é conferido onde o Node já o calcula (22.2 em diante); o tamanho, sempre.
      if (saida.length !== m.tamanho || (typeof zlib.crc32 === 'function' && zlib.crc32(saida) >>> 0 !== m.crc >>> 0)) {
        throw new Error('o .xlsx está corrompido (conteúdo do zip).');
      }
      return saida;
    },
  };
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Texto de dentro de um XML: entidades (`&amp;`, `&#233;`) e o escape `_x000D_` do Office. */
export function textoXml(t) {
  return t
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] !== '#') return ENTIDADES[e] ?? m;
      const cod = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cod > 0 && cod <= 0x10ffff ? String.fromCodePoint(cod) : '';
    })
    .replace(/_x([0-9a-f]{4})_/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Atributos de uma tag pelo nome local (`r:id` e `id` viram `id`), para valer com ou sem prefixo de namespace. */
function atributos(tag) {
  const a = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[m[1].replace(/^.*:/, '')] = textoXml(m[2] ?? m[3]);
  return a;
}

/** Elementos `<nome ...>conteúdo</nome>` ou `<nome .../>`, com ou sem prefixo: `[atributos, conteúdo]`. */
function elementos(xml, nome) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${nome}(\\s[^>]*?)?(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${nome}>)`, 'g');
  return [...xml.matchAll(re)].map((m) => [atributos(m[1] ?? ''), m[2] ?? '']);
}

/** Junta os `<t>` de um texto (simples ou com formatação por trecho), sem a leitura fonética (`<rPh>`) do japonês. */
const textoDosT = (xml) => elementos(xml.replace(/<(?:[\w.-]+:)?rPh\b[\s\S]*?<\/(?:[\w.-]+:)?rPh>/g, ''), 't').map(([, t]) => textoXml(t)).join('');

/** "A" = 0, "AB" = 27. */
const indiceDaColuna = (letras) => [...letras.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/**
 * Lê as abas de um `.xlsx`: `{ abas: Map<nome da aba, linhas>, data1904 }`. Cada linha é `{ n, celulas }`, com `n` =
 * número da linha no Excel (o que a pessoa vê) e `celulas[coluna]` = `{ tipo: 'texto'|'numero'|'erro'|'logico', valor }`
 * (coluna sem nada fica vazia no array). Datas chegam como número; quem sabe que a coluna é data converte
 * ({@link dataDoExcel}).
 */
export function lerXlsx(buf) {
  const zip = lerZip(buf);
  const xml = (nome) => zip.ler(nome)?.toString('utf8') ?? null;
  const livro = xml('xl/workbook.xml');
  if (!livro) throw new Error('o arquivo não é uma planilha do Excel (falta xl/workbook.xml).');
  const data1904 = elementos(livro, 'workbookPr').some(([a]) => a.date1904 === '1' || a.date1904 === 'true');
  const destinos = new Map(elementos(xml('xl/_rels/workbook.xml.rels') ?? '', 'Relationship').map(([a]) => [a.Id, a.Target]));
  const compartilhados = elementos(xml('xl/sharedStrings.xml') ?? '', 'si').map(([, c]) => textoDosT(c));

  const abas = new Map();
  for (const [a] of elementos(livro, 'sheet')) {
    const alvo = destinos.get(a.id);
    if (!alvo) continue;
    const caminho = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, '')}`;
    const folha = xml(caminho);
    if (folha === null) continue;
    const linhas = [];
    let anterior = 0;
    for (const [ra, conteudo] of elementos(folha, 'row')) {
      const n = ra.r ? Number(ra.r) : anterior + 1;
      anterior = n;
      const celulas = [];
      let col = -1;
      for (const [ca, cc] of elementos(conteudo, 'c')) {
        const ref = /^([A-Z]+)/i.exec(ca.r ?? '');
        col = ref ? indiceDaColuna(ref[1]) : col + 1;
        const v = elementos(cc, 'v')[0]?.[1];
        const tipo = ca.t ?? 'n';
        if (tipo === 'inlineStr') celulas[col] = { tipo: 'texto', valor: textoDosT(elementos(cc, 'is')[0]?.[1] ?? '') };
        else if (v === undefined) continue;
        else if (tipo === 's') celulas[col] = { tipo: 'texto', valor: compartilhados[Number(v)] ?? '' };
        else if (tipo === 'str' || tipo === 'd') celulas[col] = { tipo: 'texto', valor: textoXml(v) };
        else if (tipo === 'e') celulas[col] = { tipo: 'erro', valor: textoXml(v) };
        else if (tipo === 'b') celulas[col] = { tipo: 'logico', valor: v.trim() === '1' };
        else {
          const num = Number(v);
          celulas[col] = Number.isFinite(num) && v.trim() !== '' ? { tipo: 'numero', valor: num } : { tipo: 'erro', valor: v };
        }
      }
      linhas.push({ n, celulas });
    }
    abas.set(a.name ?? '', linhas);
  }
  return { abas, data1904 };
}

/**
 * Número de série do Excel para `AAAA-MM-DD`: dias desde 30/12/1899 (ou desde 01/01/1904, no sistema de datas de 1904
 * dos Macs antigos); a hora (parte decimal) é descartada. Antes de 01/03/1900 o Excel conta um 29/02/1900 que não
 * existiu, então série menor que 61 é recusada em vez de virar um dia errado.
 */
export function dataDoExcel(serial, data1904 = false) {
  if (!Number.isFinite(serial) || serial < (data1904 ? 0 : 61) || serial >= 2958466) return null;
  const base = data1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}

/** Texto da célula: número sem notação estranha (45 e não 45.0), vazio para erro, lógico e célula vazia. */
function texto(celula) {
  if (!celula) return '';
  if (celula.tipo === 'texto') return celula.valor.trim();
  if (celula.tipo === 'numero') return String(celula.valor);
  return '';
}

const vazia = (celula) => !celula || (celula.tipo === 'texto' && celula.valor.trim() === '');

/** Data da célula: `undefined` se vazia, `null` se não é data (texto estranho, erro de fórmula, série impossível). */
function dataDaCelula(celula, data1904) {
  if (vazia(celula)) return undefined;
  if (celula.tipo === 'numero') return dataDoExcel(celula.valor, data1904);
  if (celula.tipo === 'texto') return dataIso(celula.valor);
  return null;
}

/**
 * Peso da célula: `undefined` se vazia, `null` se inválido. Número do Excel com resto de conta de ponto flutuante
 * (81.9000000001) volta às duas casas; com uma terceira casa de verdade (81.955) é inválido: nunca arredondamos peso.
 */
function pesoDaCelula(celula) {
  if (vazia(celula)) return undefined;
  if (celula.tipo === 'numero') {
    const r = Math.round(celula.valor * 100) / 100;
    return Math.abs(celula.valor - r) > 1e-6 ? null : pesoKg(String(r));
  }
  return celula.tipo === 'texto' ? pesoKg(celula.valor) : null;
}

/** Acha a aba pelo nome sem acento e caixa ("Histórico Pesos" = "historico_pesos"). */
function aba(planilha, nomes, rotulo) {
  for (const [nome, linhas] of planilha.abas) if (nomes.includes(coluna(nome))) return linhas;
  throw new Error(`não achei a aba "${rotulo}" na planilha.`);
}

/**
 * Acha o cabeçalho nas primeiras 20 linhas (pode haver título acima): a primeira que tem todas as colunas `exigidas`.
 * Devolve o índice de cada coluna pelo nome comparável e o índice da coluna de ID: a chamada `id` ou, sem ela, a primeira
 * célula do cabeçalho (na planilha do Saraiva ela às vezes guarda um ID em vez do título "ID"), desde que não seja uma
 * coluna conhecida.
 */
function cabecalho(linhas, exigidas, conhecidas, rotulo) {
  for (const [i, linha] of linhas.slice(0, 20).entries()) {
    const indices = new Map();
    let primeira = -1;
    linha.celulas.forEach((c, col) => {
      const nome = coluna(texto(c));
      if (!nome) return;
      if (primeira < 0) primeira = col;
      if (!indices.has(nome)) indices.set(nome, col);
    });
    if (!exigidas.every((c) => indices.has(c))) continue;
    const primeiraConhecida = conhecidas.includes(coluna(texto(linha.celulas[primeira])));
    const id = indices.get('id') ?? (primeiraConhecida ? -1 : primeira);
    return { inicio: i + 1, indices, id };
  }
  throw new Error(`aba "${rotulo}": não achei o cabeçalho (precisa das colunas ${exigidas.join(', ')}).`);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ABA_ALUNOS = 'Alunos';
const ABA_PESOS = 'Histórico Pesos';
const COLUNAS_ALUNOS = ['id', 'nome', 'email', 'telefone', 'peso_inicial_kg', 'objetivo', 'data_inicio', 'status', 'obs'];
const COLUNAS_PESOS = ['id', 'id_aluno', 'nome_aluno', 'data', 'semana_n', 'peso_kg', 'variacao_kg', 'observacao'];

/**
 * Converte a planilha lida por {@link lerXlsx}. `hoje` = `AAAA-MM-DD` (peso no futuro é problema, como no importador).
 *
 * Aba "Alunos": `codigo` = o ID da planilha, nome com os espaços arrumados, e-mail em minúsculas (inválido = aluno sem
 * e-mail, com o problema anotado) e `dias_atualizacao` vazio (usa o padrão da consultoria). Telefone, Objetivo e Obs
 * ficam de fora: o importador não os grava, e objetivo e observação são dado sensível. Status diferente de ativo só é
 * contado: o aluno é convertido mesmo assim e entra ativo (desativar depois é um toque na lista de alunos), para o
 * histórico de peso de quem saiu não se perder. "Peso Inicial (kg)" com "Data Início" vira também uma linha de peso,
 * se o histórico não tiver já um peso do aluno naquela data.
 *
 * Aba "Histórico Pesos": ID Aluno, Data, Peso (kg) e Observação; Semana, Variação e Nome Aluno não são usados (a
 * variação o app calcula do próprio histórico). Linha sem data, com data no futuro ou inválida, peso inválido, sem ID do
 * aluno, com ID que não está na aba Alunos ou repetindo aluno e data fica fora e entra nos problemas.
 *
 * Devolve `{ alunos, pesos, problemas, contagens }`; `problemas` = `{ aba, linha, tipo, motivo }`, sem valor nenhum da
 * planilha (só números de linha). Aba ou cabeçalho que falta é erro (exceção), porque aí nada faz sentido converter.
 */
export function converter(planilha, hoje) {
  const problemas = [];
  const problema = (abaNome, linha, tipo, detalhe = '') => problemas.push({ aba: abaNome, linha, tipo, motivo: tipo + detalhe });

  const linhasAlunos = aba(planilha, ['alunos'], ABA_ALUNOS);
  const linhasPesos = aba(planilha, ['historico_pesos', 'historico_de_pesos'], ABA_PESOS);
  const ca = cabecalho(linhasAlunos, ['nome'], COLUNAS_ALUNOS, ABA_ALUNOS);
  const cp = cabecalho(linhasPesos, ['id_aluno', 'data', 'peso_kg'], COLUNAS_PESOS, ABA_PESOS);
  const col = (c, ...nomes) => nomes.map((n) => c.indices.get(n)).find((i) => i !== undefined) ?? -1;
  const celula = (linha, i) => (i < 0 ? undefined : linha.celulas[i]);

  const alunos = [];
  const porCodigo = new Map();
  const nomes = new Map();
  const iniciais = [];
  let inativos = 0;
  const [cNome, cEmail, cPeso, cData, cStatus] = [
    col(ca, 'nome'), col(ca, 'email', 'e_mail'), col(ca, 'peso_inicial_kg', 'peso_inicial'), col(ca, 'data_inicio', 'data_de_inicio'), col(ca, 'status'),
  ];
  for (const linha of linhasAlunos.slice(ca.inicio)) {
    if (linha.celulas.every(vazia)) continue;
    const codigo = texto(celula(linha, ca.id));
    if (!codigo) { problema(ABA_ALUNOS, linha.n, 'aluno sem ID'); continue; }
    if (porCodigo.has(codigo)) { problema(ABA_ALUNOS, linha.n, 'ID repetido', ` (já na linha ${porCodigo.get(codigo).n})`); continue; }
    const nome = texto(celula(linha, cNome)).replace(/\s+/g, ' ');
    if (!nome || nome.length > 120) {
      problema(ABA_ALUNOS, linha.n, nome ? 'nome com mais de 120 letras' : 'aluno sem nome');
      porCodigo.set(codigo, { n: linha.n, fora: true });
      continue;
    }
    let email = texto(celula(linha, cEmail)).toLowerCase();
    if (email && (!EMAIL.test(email) || email.length > 254)) {
      problema(ABA_ALUNOS, linha.n, 'e-mail inválido (aluno convertido sem e-mail)');
      email = '';
    }
    const chave = chaveDoNome(nome);
    if (nomes.has(chave)) problema(ABA_ALUNOS, linha.n, 'mesmo nome de outro aluno', ` (linha ${nomes.get(chave)}; o importador para até corrigir)`);
    else nomes.set(chave, linha.n);
    const status = chaveDoNome(texto(celula(linha, cStatus)));
    if (status && !/^ativ[oa]s?$/.test(status)) inativos++;

    const kg = pesoDaCelula(celula(linha, cPeso));
    if (kg !== undefined) {
      const data = dataDaCelula(celula(linha, cData), planilha.data1904);
      if (kg === null) problema(ABA_ALUNOS, linha.n, 'peso inicial inválido');
      else if (data === undefined) problema(ABA_ALUNOS, linha.n, 'peso inicial sem data de início');
      else if (data === null) problema(ABA_ALUNOS, linha.n, 'data de início inválida');
      else if (data > hoje) problema(ABA_ALUNOS, linha.n, 'data de início no futuro');
      else iniciais.push({ codigo, data, pesoKg: kg });
    }
    const aluno = { n: linha.n, codigo, nome, email };
    porCodigo.set(codigo, aluno);
    alunos.push(aluno);
  }

  const pesos = [];
  const vistos = new Map();
  const [cAluno, cDataPeso, cKg, cObs] = [col(cp, 'id_aluno'), col(cp, 'data'), col(cp, 'peso_kg', 'peso'), col(cp, 'observacao', 'obs')];
  for (const linha of linhasPesos.slice(cp.inicio)) {
    if (linha.celulas.every(vazia)) continue;
    const codigo = texto(celula(linha, cAluno));
    const aluno = porCodigo.get(codigo);
    const data = dataDaCelula(celula(linha, cDataPeso), planilha.data1904);
    const kg = pesoDaCelula(celula(linha, cKg));
    let observacao = texto(celula(linha, cObs)).replace(/\s+/g, ' ');
    if (!codigo) { problema(ABA_PESOS, linha.n, 'peso sem ID do aluno'); continue; }
    if (!aluno) { problema(ABA_PESOS, linha.n, 'ID do aluno não está na aba Alunos'); continue; }
    if (aluno.fora) { problema(ABA_PESOS, linha.n, 'aluno ficou fora da conversão', ` (aba Alunos, linha ${aluno.n})`); continue; }
    if (data === undefined) { problema(ABA_PESOS, linha.n, 'sem data'); continue; }
    if (data === null) { problema(ABA_PESOS, linha.n, 'data inválida'); continue; }
    if (data > hoje) { problema(ABA_PESOS, linha.n, 'data no futuro'); continue; }
    if (kg === undefined) { problema(ABA_PESOS, linha.n, 'sem peso'); continue; }
    if (kg === null) { problema(ABA_PESOS, linha.n, 'peso inválido'); continue; }
    const chave = `${codigo}|${data}`;
    if (vistos.has(chave)) { problema(ABA_PESOS, linha.n, 'mesmo aluno e data', ` (linha ${vistos.get(chave)})`); continue; }
    if (observacao.length > 300) {
      problema(ABA_PESOS, linha.n, 'observação com mais de 300 letras (peso convertido sem observação)');
      observacao = '';
    }
    vistos.set(chave, linha.n);
    pesos.push({ codigo, data, pesoKg: kg, observacao });
  }

  let iniciaisNoHistorico = 0;
  for (const p of iniciais) {
    if (vistos.has(`${p.codigo}|${p.data}`)) { iniciaisNoHistorico++; continue; }
    vistos.set(`${p.codigo}|${p.data}`, 0);
    pesos.push({ ...p, observacao: '' });
  }
  const ordem = new Map(alunos.map((a, i) => [a.codigo, i]));
  pesos.sort((a, b) => ordem.get(a.codigo) - ordem.get(b.codigo) || a.data.localeCompare(b.data));

  return {
    alunos,
    pesos,
    problemas,
    contagens: {
      alunos: alunos.length,
      inativos,
      pesos: pesos.length,
      pesosIniciais: iniciais.length - iniciaisNoHistorico,
      iniciaisNoHistorico,
    },
  };
}

/** Campo CSV com `;`: aspas só quando precisa; quebra de linha vira espaço (o importador lê uma linha por registro). */
const campoCsv = (v) => {
  const t = String(v ?? '').replace(/[\r\n]+/g, ' ');
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (linhas) => `${linhas.map((l) => l.map(campoCsv).join(';')).join('\n')}\n`;
const dataBr = (iso) => iso.split('-').reverse().join('/');

/** Os três arquivos, no formato exato de `modelos/` (`;`, data DD/MM/AAAA, peso com vírgula). */
export function arquivosCsv({ alunos, pesos, problemas }) {
  return {
    'alunos.csv': csv([['codigo', 'nome', 'email', 'dias_atualizacao'], ...alunos.map((a) => [a.codigo, a.nome, a.email, ''])]),
    'pesos.csv': csv([
      ['codigo', 'data', 'peso_kg', 'observacao'],
      ...pesos.map((p) => [p.codigo, dataBr(p.data), String(p.pesoKg).replace('.', ','), p.observacao]),
    ]),
    'problemas.csv': csv([['aba', 'linha', 'motivo'], ...problemas.map((p) => [p.aba, p.linha, p.motivo])]),
  };
}

/** Resumo para o terminal: só contagens, e os problemas agrupados por aba e tipo. */
export function resumo({ contagens: c, problemas }) {
  const linhas = [
    `Convertido: ${c.alunos} alunos (${c.inativos} não ativos na planilha; o importador cria todos ativos) e ${c.pesos} pesos ` +
      `(${c.pesos - c.pesosIniciais} do histórico e ${c.pesosIniciais} do peso inicial; ${c.iniciaisNoHistorico} pesos iniciais já estavam no histórico).`,
  ];
  if (problemas.length === 0) return [...linhas, 'Problemas: nenhum.'];
  const grupos = new Map();
  for (const p of problemas) grupos.set(`${p.aba}: ${p.tipo}`, (grupos.get(`${p.aba}: ${p.tipo}`) ?? 0) + 1);
  return [
    ...linhas,
    `Problemas: ${problemas.length} linha(s) em problemas.csv (só aba, linha e motivo):`,
    ...[...grupos].map(([k, n]) => `- ${k}: ${n}`),
  ];
}
