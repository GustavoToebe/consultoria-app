// Gerador mínimo de .xlsx (zip + XML) só para os testes: as planilhas são sempre fictícias e montadas na memória.
// Usado por planilha.test.mjs e planos.test.mjs. Não é importado por nenhum script de verdade.
import { deflateRawSync } from 'node:zlib';

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
export function zip(membros, guardar = [], crcErrado = []) {
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
    local.writeUInt32LE((crc32(dados) ^ (crcErrado.includes(nome) ? 1 : 0)) >>> 0, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE((crc32(dados) ^ (crcErrado.includes(nome) ? 1 : 0)) >>> 0, 16);
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
export const serie = (iso) => (Date.UTC(...iso.split('-').map((v, i) => Number(v) - (i === 1 ? 1 : 0))) - Date.UTC(1899, 11, 30)) / 86400000;

/**
 * Monta um .xlsx com as abas dadas: `{ nome: [linha, ...] }`, cada linha um array de células. Célula: texto (vai para
 * os textos compartilhados), número, `null` (vazia), `{ inline }`, `{ erro }` ou `{ data: 'AAAA-MM-DD' }` (número do
 * Excel, como o Excel grava uma data). `linhaInicial` numera a primeira linha (para testar título acima do cabeçalho).
 */
export function xlsx(abas, { linhaInicial = 1, crcErrado = [] } = {}) {
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
          if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
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
  }, ['xl/workbook.xml'], crcErrado);
}
