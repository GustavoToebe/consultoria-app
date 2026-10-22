/**
 * Link de vídeo: só https e hosts do YouTube, como `VideoUrls` da API (que confere de novo). Recusa
 * `javascript:`, `data:` e qualquer outro host.
 */
const TAMANHO_MAXIMO = 500;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

export function videoValido(url: string | null | undefined): boolean {
  if (!url || url.length > TAMANHO_MAXIMO) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' && HOSTS.has(u.hostname.toLowerCase()) && !u.username && !u.password && u.port === '';
  } catch {
    return false;
  }
}

/** Mensagem para o campo (vazio é aceito: o vídeo é opcional). */
export function erroDoVideo(url: string | null | undefined): string | null {
  return url && url.trim() && !videoValido(url) ? 'Use um link https do YouTube.' : null;
}
