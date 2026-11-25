/**
 * Navegador de dentro de outro aplicativo (Instagram, Facebook, WhatsApp, TikTok...) e Android, pelo `userAgent`. O
 * Turnstile costuma falhar nesses navegadores; quando falha, a tela oferece "Copiar link" e, no Android, "Abrir no Chrome"
 * (nunca desliga nem contorna a verificação). Regras puras, sem React nem `window`, para testar sem aparelho.
 */

export const TITULO_ABRA_NO_NAVEGADOR = 'Abra no navegador para entrar';
export const TEXTO_ABRA_NO_NAVEGADOR =
  'A verificação de segurança não funcionou neste navegador. Copie o link e abra no navegador do celular.';

/**
 * Marcas que os navegadores embutidos põem no `userAgent`: Instagram, Facebook (FBAN, FBAV, FB_IAB), Line, WeChat, Snapchat,
 * TikTok (musical_ly, BytedanceWebview), X, LinkedIn, Pinterest, WhatsApp e o `; wv)` do WebView do Android.
 * shortcut: lista fixa de marcas conhecidas, app novo fora dela não é detectado (a falha do widget no Android ainda oferece o bloco); revisar quando aparecer relato.
 */
const NAVEGADOR_EMBUTIDO =
  /Instagram|FBAN|FBAV|FB_IAB|\bLine\/|MicroMessenger|Snapchat|TikTok|musical_ly|BytedanceWebview|Twitter|LinkedInApp|Pinterest|WhatsApp|;\s*wv\)/i;

function texto(userAgent: unknown): string {
  return typeof userAgent === 'string' ? userAgent : '';
}

export function ehNavegadorEmbutido(userAgent: unknown): boolean {
  return NAVEGADOR_EMBUTIDO.test(texto(userAgent));
}

export function ehAndroid(userAgent: unknown): boolean {
  return /\bAndroid\b/i.test(texto(userAgent));
}

/** Verificação que falhou: oferecer abrir em outro navegador quando o navegador é embutido ou é Android (a falha persistiu). */
export function oferecerOutroNavegador(userAgent: unknown): boolean {
  return ehNavegadorEmbutido(userAgent) || ehAndroid(userAgent);
}

/**
 * Link `intent://` que o Android abre no Chrome (com a página atual de volta se o Chrome não existir). O fragmento (`#codigo=...`)
 * NÃO vai no intent: pode levar token e sairia para outro aplicativo (revisão de 25/11). `null` se não for um endereço http(s).
 */
export function linkParaChrome(endereco: unknown): string | null {
  if (typeof endereco !== 'string') return null;
  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const esquema = url.protocol.slice(0, -1);
  const semFragmento = `${url.origin}${url.pathname}${url.search}`;
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${esquema};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(semFragmento)};end`;
}
