/**
 * Link externo (produto, página do fabricante): só `https://` sem usuário e senha, de qualquer host, até 500
 * caracteres. Mesma regra de `LinksExternos` da API (que confere de novo ao salvar). O app confere antes de abrir fora
 * do app (sem token) e antes de pôr o link no PDF. Vídeo tem regra própria, só YouTube (`dominio/video.ts`).
 */
export const TAMANHO_MAXIMO_LINK = 500;
export const MENSAGEM_LINK = 'Use um link https completo.';

export function linkExternoSeguro(url: string | null | undefined): boolean {
  if (!url) return false;
  const texto = url.trim();
  if (!texto || texto.length > TAMANHO_MAXIMO_LINK) return false;
  try {
    const u = new URL(texto);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      u.hostname !== '' &&
      (u.port === '' || u.port === '443') &&
      // O `URL` do navegador troca a barra invertida por barra e aceita "https:exemplo.com"; a API recusa os dois.
      !texto.includes('\\') &&
      /^https:\/\/[^/]/i.test(texto)
    );
  } catch {
    return false;
  }
}

/** Link já conferido ou `null` (nada a abrir). */
export function linkParaAbrir(url: string | null | undefined): string | null {
  return linkExternoSeguro(url) ? url!.trim() : null;
}

/** Mensagem para o campo (vazio é aceito: o link é opcional). */
export function erroDoLink(url: string | null | undefined): string | null {
  return url && url.trim() && !linkExternoSeguro(url) ? MENSAGEM_LINK : null;
}
