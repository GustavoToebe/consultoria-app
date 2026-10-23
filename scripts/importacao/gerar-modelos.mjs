// Modelos da tela Importação (não os CSVs do script do Saraiva). Roda com `node scripts/importacao/gerar-modelos.mjs`.
import { deflateRawSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PESSOAS = [
  ['Ana Fictícia', 'ana.ficticia@exemplo.com', '012.345.678-90'],
  ['Bruno Fictício', 'bruno.ficticio@exemplo.com', '529.982.247-25'],
  ['Carla Fictícia', 'carla.ficticia@exemplo.com', '390.533.447-05'],
];

/** Cabeçalho e três linhas fictícias. Telefone, CEP e CPF são texto; data é DD/MM/AAAA. */
const PLANILHAS = [
  {
    arquivo: 'alunos',
    titulo: 'Alunos',
    chave: 'e-mail',
    existentes: 'Ignorar, Completar ou Atualizar',
    cabecalho: ['Nome', 'E-mail', 'Telefone', 'CPF', 'Objetivo', 'Observações', 'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'Responsável', 'Dias', 'Situação'],
    linhas: PESSOAS.map(([nome, email, cpf]) => [nome, email, '', cpf, 'Condicionamento', '', '', '', '', '', '', '', '', '', '', 'ativo']),
    instrucoes: [
      ['Nome', 'Sim', 'Até 120 letras', 'Ana Fictícia'],
      ['E-mail', 'Sim, se for a chave', 'E-mail', 'ana.ficticia@exemplo.com'],
      ['Telefone', 'Não', 'DDD e número. Só vale para aluno que já tem acesso ao app. Em aluno novo, deixe vazio.', ''],
      ['CPF', 'Não', 'Texto, com o zero à esquerda', '012.345.678-90'],
      ['Objetivo', 'Não', 'Até 200 letras. Dado sensível.', 'Condicionamento'],
      ['Observações', 'Não', 'Até 4.000 letras. Dado sensível.', ''],
      ['CEP, logradouro, número, cidade e UF', 'Juntos', 'Se preencher um, preencha estes. Dado sensível.', ''],
      ['Complemento e bairro', 'Não', 'Dado sensível.', ''],
      ['Responsável', 'Não', 'E-mail de um treinador da consultoria. Vazio usa quem importa.', ''],
      ['Dias', 'Não', 'De 1 a 365', '30'],
      ['Situação', 'Não', 'ativo ou inativo. Aluno novo inativo não ocupa vaga.', 'ativo'],
    ],
  },
  {
    arquivo: 'pesos',
    titulo: 'Pesos',
    chave: 'e-mail, CPF ou nome do aluno',
    existentes: 'Ignorar ou Substituir, pela mesma data',
    cabecalho: ['Aluno', 'Data', 'Peso', 'Observação'],
    linhas: PESSOAS.map(([nome, email], i) => [email, `0${i + 1}/01/2026`, i === 0 ? '70,5' : i === 1 ? '80' : '62,4', 'Avaliação fictícia']),
    instrucoes: [
      ['Aluno', 'Sim', 'O e-mail, o CPF ou o nome, conforme a chave escolhida. As três pessoas são as do modelo de alunos.', 'ana.ficticia@exemplo.com'],
      ['Data', 'Sim', 'DD/MM/AAAA. Data futura é recusada.', '01/01/2026'],
      ['Peso', 'Sim', 'Maior que 0 e menor que 500. Vírgula ou ponto.', '70,5'],
      ['Observação', 'Não', 'Até 300 letras', 'Avaliação fictícia'],
    ],
  },
  {
    arquivo: 'exercicios',
    titulo: 'Exercícios',
    chave: 'nome',
    existentes: 'Ignorar, Completar ou Atualizar',
    cabecalho: ['Nome', 'Grupo', 'Equipamento', 'Modalidade', 'Vídeo', 'Observações'],
    linhas: [
      ['Remada fictícia', 'Costas', 'Barra', 'livre', '', 'Movimento fictício'],
      ['Agachamento fictício', 'Pernas', 'Barra', 'livre', '', ''],
      ['Prancha fictícia', 'Abdômen', '', 'peso corporal', '', ''],
    ],
    instrucoes: [
      ['Nome', 'Sim', 'Até 120 letras', 'Remada fictícia'],
      ['Grupo', 'Não', 'Até 60 letras', 'Costas'],
      ['Equipamento', 'Não', 'Até 60 letras', 'Barra'],
      ['Modalidade', 'Não', 'livre, maquina, elastico, peso corporal, cardio ou outro. Vazio vira máquina.', 'livre'],
      ['Vídeo', 'Não', 'Link https do YouTube', ''],
      ['Observações', 'Não', 'Até 4.000 letras', ''],
    ],
  },
  {
    arquivo: 'alimentos',
    titulo: 'Alimentos',
    chave: 'nome',
    existentes: 'Ignorar, Completar ou Atualizar',
    cabecalho: ['Nome', 'Quantidade', 'Unidade', 'Kcal', 'Proteína', 'Carboidrato', 'Gordura', 'Gramas', 'Fonte', 'FC', 'FCc'],
    linhas: [
      ['Aveia fictícia', '100', 'g', '380', '13', '67', '7', '', 'Tabela fictícia', '', ''],
      ['Iogurte fictício', '170', 'g', '100', '6', '12', '3', '', '', '', ''],
      ['Suco fictício', '200', 'ml', '90', '1', '20', '0', '', '', '', ''],
    ],
    instrucoes: [
      ['Nome', 'Sim', 'Até 160 letras', 'Aveia fictícia'],
      ['Quantidade', 'Sim na criação', 'Maior que 0. Célula vazia não vira zero.', '100'],
      ['Unidade', 'Sim na criação', 'g, ml ou un', 'g'],
      ['Kcal, proteína, carboidrato e gordura', 'Sim na criação', 'De 0 a 99999. Vazio na criação é erro, não zero.', '380'],
      ['Gramas', 'Não', 'Gramas por unidade, se a unidade for un', ''],
      ['Fonte', 'Não', 'Até 200 letras', 'Tabela fictícia'],
      ['FC', 'Não', 'Fator de correção, de 1 a 20. Vazio fica sem fator.', '1,75'],
      ['FCc', 'Não', 'Fator de cocção, de 0,1 a 10. Vazio fica sem fator.', '2,5'],
    ],
  },
  {
    arquivo: 'suplementos',
    titulo: 'Suplementos',
    chave: 'nome e marca',
    existentes: 'Ignorar, Completar ou Atualizar. O mesmo nome com outra marca é erro.',
    cabecalho: ['Nome', 'Marca', 'Categoria', 'Porção', 'Porções', 'Sabores', 'Link'],
    linhas: [
      ['Whey fictício', 'Marca Fictícia', 'Proteína', '30 g', '20', 'Baunilha', ''],
      ['Creatina fictícia', 'Marca Fictícia', 'Aminoácido', '3 g', '100', '', ''],
      ['Cafeína em cápsula fictícia', 'Outra Marca Fictícia', 'Estimulante', '200 mg', '60', '', ''],
    ],
    instrucoes: [
      ['Nome', 'Sim', 'Até 120 letras. No cadastro o suplemento é único pelo nome.', 'Whey fictício'],
      ['Marca', 'Sim', 'Até 80 letras. Outra marca para um nome que já existe é erro da linha.', 'Marca Fictícia'],
      ['Categoria', 'Não', 'Até 60 letras', 'Proteína'],
      ['Porção', 'Não', 'Até 80 letras', '30 g'],
      ['Porções', 'Não', 'Porções por embalagem, até 40 letras', '20'],
      ['Sabores', 'Não', 'Separados por ponto e vírgula, até 20', 'Baunilha'],
      ['Link', 'Não', 'https', ''],
    ],
  },
  {
    arquivo: 'outros',
    titulo: 'Outros',
    chave: 'nome',
    existentes: 'Ignorar, Completar ou Atualizar',
    cabecalho: ['Nome', 'Categoria', 'Princípio', 'Concentração', 'Apresentação', 'Observação'],
    linhas: [
      ['Cafeína fictícia', 'Estimulante', 'Cafeína', '200 mg', 'Cápsula', 'Item fictício'],
      ['Ômega fictício', 'Ácido graxo', 'EPA e DHA', '1000 mg', 'Cápsula', ''],
      ['Magnésio fictício', 'Mineral', 'Magnésio', '300 mg', 'Comprimido', ''],
    ],
    instrucoes: [
      ['Nome', 'Sim', 'Até 120 letras', 'Cafeína fictícia'],
      ['Categoria', 'Não', 'Até 60 letras', 'Estimulante'],
      ['Princípio', 'Não', 'Até 160 letras', 'Cafeína'],
      ['Concentração', 'Não', 'Até 40 letras', '200 mg'],
      ['Apresentação', 'Não', 'Até 40 letras', 'Cápsula'],
      ['Observação', 'Não', 'Até 500 letras', 'Item fictício'],
    ],
  },
];

const REGRAS = [
  ['A primeira linha da aba Dados é o cabeçalho.', '', '', ''],
  ['Célula vazia não apaga o que já está e não vira zero.', '', '', ''],
  ['CPF, telefone e CEP precisam ser texto, para o zero à esquerda não sumir.', '', '', ''],
  ['Data no formato DD/MM/AAAA.', '', '', ''],
  ['Não há fórmula, macro nem célula mesclada.', '', '', ''],
];

export function arquivos() {
  const saida = {};
  for (const planilha of PLANILHAS) {
    const dados = [planilha.cabecalho, ...planilha.linhas];
    saida[`${planilha.arquivo}.csv`] = csv(dados);
    saida[`${planilha.arquivo}.xlsx`] = xlsx(planilha, dados);
  }
  return saida;
}

function csv(linhas) {
  const texto = linhas.map((l) => l.join(';')).join('\n') + '\n';
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(texto, 'utf8')]);
}

function xlsx(planilha, dados) {
  const instrucoes = [['Campo', 'Obrigatório', 'Formato', 'Exemplo'], ...planilha.instrucoes, ...REGRAS,
    [`Chave: ${planilha.chave}.`, '', '', ''],
    [`Quando o registro já existe: ${planilha.existentes}.`, '', '', '']];
  const textos = [];
  const indice = (valor) => {
    const i = textos.indexOf(valor);
    if (i >= 0) return i;
    textos.push(valor);
    return textos.length - 1;
  };
  const sheet1 = planilhaXml(dados, indice);
  const sheet2 = planilhaXml(instrucoes, indice);
  const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${textos.length}" uniqueCount="${textos.length}">${textos.map((t) => `<si><t xml:space="preserve">${xml(t)}</t></si>`).join('')}</sst>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/><sheet name="Instruções" sheetId="2" r:id="rId2"/></sheets></workbook>`;
  const relsWb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;
  return zip([
    ['[Content_Types].xml', tipos],
    ['_rels/.rels', rels],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', relsWb],
    ['xl/sharedStrings.xml', sst],
    ['xl/worksheets/sheet1.xml', sheet1],
    ['xl/worksheets/sheet2.xml', sheet2],
  ]);
}

function planilhaXml(linhas, indice) {
  const rows = linhas.map((linha, r) => {
    const celulas = linha.map((valor, c) => `<c r="${letra(c)}${r + 1}" t="s"><v>${indice(valor)}</v></c>`).join('');
    return `<row r="${r + 1}">${celulas}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

function letra(indice) {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xml(texto) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function zip(entradas) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const [nome, texto] of entradas) {
    const nomeBuf = Buffer.from(nome);
    const dados = Buffer.from(texto);
    const crc = crc32(dados) >>> 0;
    const comprimido = deflateRawSync(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    const bloco = Buffer.concat([local, nomeBuf, comprimido]);
    locais.push(bloco);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nomeBuf.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(Buffer.concat([central, nomeBuf]));
    deslocamento += bloco.length;
  }
  const corpo = Buffer.concat(locais);
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(corpo.length, 16);
  return Buffer.concat([corpo, diretorio, fim]);
}

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, '..', '..', 'app', 'public', 'modelos', 'importacao');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(destino, { recursive: true });
  for (const [nome, bytes] of Object.entries(arquivos())) writeFileSync(join(destino, nome), bytes);
}
