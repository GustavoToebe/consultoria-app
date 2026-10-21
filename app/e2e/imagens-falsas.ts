import { deflateSync } from 'node:zlib';

/** Imagens fictícias geradas aqui mesmo: quadrados de uma cor só, sem relação com nenhum exercício ou pessoa. */

function crc32(bytes: Buffer): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const cabeca = Buffer.alloc(4);
  cabeca.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const fim = Buffer.alloc(4);
  fim.writeUInt32BE(crc32(corpo));
  return Buffer.concat([cabeca, corpo, fim]);
}

/** PNG `lado` x `lado` de uma cor só. */
export function pngDeCor(lado: number, [r, g, b]: [number, number, number]): Buffer {
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(lado, 0);
  cabecalho.writeUInt32BE(lado, 4);
  cabecalho.set([8, 2, 0, 0, 0], 8);
  const linha = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: lado }, () => [r, g, b]).flat())]);
  const bruto = Buffer.concat(Array.from({ length: lado }, () => linha));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(bruto)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/** GIF de 1 pixel (o conteúdo não importa: o teste confere o envio, não a animação). */
export const GIF_FALSO = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
