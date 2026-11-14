const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes UTF-8 do texto; par substituto solto (texto inválido) vira U+FFFD, como no `TextEncoder`. */
function bytesUtf8(texto: string): number[] {
  const bytes: number[] = [];
  for (const caractere of texto) {
    let c = caractere.codePointAt(0) as number;
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return bytes;
}

/**
 * Texto (UTF-8) em base64. Puro: sem `btoa` (que recusa o que passa de Latin1) nem `Buffer` (que o Hermes pode não ter),
 * então serve igual na web e no celular. Usado no `data:image/svg+xml;base64,` do gráfico do PDF.
 */
export function base64DeTexto(texto: string): string {
  const b = bytesUtf8(texto);
  let saida = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    saida += ALFABETO[(n >> 18) & 63] + ALFABETO[(n >> 12) & 63];
    saida += i + 1 < b.length ? ALFABETO[(n >> 6) & 63] : '=';
    saida += i + 2 < b.length ? ALFABETO[n & 63] : '=';
  }
  return saida;
}
