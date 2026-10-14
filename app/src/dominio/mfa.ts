/** Regras puras da verificação em duas etapas (entrar com código, ativar, desativar). */

/** O login respondeu "falta o código": a tela de entrar passa a pedir o código do aplicativo autenticador. */
export function pedeCodigoMfa(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && (erro as { codigo?: unknown }).codigo === 'MFA_NECESSARIO';
}

/**
 * Código como a pessoa digita: "123 456" vira "123456" e o código de recuperação (32 caracteres hexadecimais) vale em
 * maiúsculas ou colado com espaços. Não valida nada: quem confere é o servidor.
 */
export function normalizarCodigo(texto: string): string {
  const semEspacos = texto.replace(/[\s-]+/g, '');
  return /^[0-9a-f]{32}$/i.test(semEspacos) ? semEspacos.toLowerCase() : semEspacos;
}

/** O código serve para enviar: 6 dígitos do aplicativo ou 32 hexadecimais de recuperação (só para habilitar o botão). */
export function codigoPreenchido(texto: string): boolean {
  const codigo = normalizarCodigo(texto);
  return /^[0-9]{6}$/.test(codigo) || /^[0-9a-f]{32}$/.test(codigo);
}

/** Segredo em blocos de 4 letras para ler e digitar no aplicativo autenticador. */
export function segredoEmBlocos(segredo: string): string {
  return segredo.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}

/** Códigos de recuperação como texto para copiar: um por linha. */
export function codigosParaCopiar(codigos: readonly string[]): string {
  return codigos.join('\n');
}

/**
 * Desenho do QR code como um caminho SVG só: cada sequência de módulos escuros de uma linha vira um retângulo de altura 1.
 * `modulos` vem do `toQR` (um byte por módulo, linha a linha); a margem de 4 módulos é obrigatória para o leitor achar o código.
 */
export function caminhoDoQr(modulos: ArrayLike<number>, margem = 4): { caminho: string; lado: number } {
  const lado = Math.round(Math.sqrt(modulos.length));
  if (lado * lado !== modulos.length) {
    throw new Error('Matriz de QR inválida.');
  }
  const partes: string[] = [];
  for (let linha = 0; linha < lado; linha++) {
    let coluna = 0;
    while (coluna < lado) {
      if (modulos[linha * lado + coluna] === 0) {
        coluna++;
        continue;
      }
      const inicio = coluna;
      while (coluna < lado && modulos[linha * lado + coluna] !== 0) coluna++;
      partes.push(`M${inicio + margem} ${linha + margem}h${coluna - inicio}v1h-${coluna - inicio}z`);
    }
  }
  return { caminho: partes.join(''), lado: lado + margem * 2 };
}
