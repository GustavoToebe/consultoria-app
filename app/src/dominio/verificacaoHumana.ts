/**
 * Regras puras da verificação humana (Cloudflare Turnstile) em entrar, cadastro e "esqueci a senha": chave do widget,
 * mensagens do widget, página do WebView (celular), navegação permitida e estado do botão de envio. Sem React nem
 * WebView, para testar sem aparelho. O token é de uso único e nunca vai a log.
 */

export const URL_DO_SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Hostname cadastrado no widget da Cloudflare: o WebView finge ser esta página (`baseUrl`). Fica FORA do HTML. */
export const ORIGEM_DO_WIDGET = 'https://consultoria.servirea.com.br';

const HOST_DA_ORIGEM = 'consultoria.servirea.com.br';
const HOST_DO_DESAFIO = 'challenges.cloudflare.com';

/** Tamanho máximo do token (o mesmo limite do campo `turnstileToken` na API). */
export const TOKEN_MAXIMO = 2048;
/** Uma mensagem do WebView maior que isto nem é lida (o token cabe com folga). */
const MENSAGEM_MAXIMA = 4096;

export const ALTURA_INICIAL = 65;
const ALTURA_MAXIMA = 500;

/** Renovações automáticas seguidas, sem token no meio, antes de desistir e mostrar o erro com "Tentar de novo". */
export const LIMITE_DE_FALHAS_SEGUIDAS = 3;

export const TEXTO_VERIFICANDO = 'Verificando…';
export const MOTIVO_VERIFICANDO = 'Confirmando que você é uma pessoa.';
export const TEXTO_FALHA_AO_CARREGAR = 'Não foi possível carregar a verificação de segurança.';
export const TEXTO_NAO_CONFIRMOU = 'Não foi possível confirmar que você é uma pessoa. Tente de novo.';

export type TemaDoWidget = 'light' | 'dark';

/** Chave pública do Turnstile (ex.: `0x4AAAAAAA...`, ou `1x00000000000000000000AA` nas chaves de teste). */
export function siteKeyValida(chave: unknown): chave is string {
  return typeof chave === 'string' && /^[0-9A-Za-z_-]{10,64}$/.test(chave);
}

export type MensagemDoWidget =
  | { tipo: 'token'; token: string }
  | { tipo: 'expirou' }
  | { tipo: 'erro' }
  /** A página não conseguiu nem carregar o script ou desenhar o widget: não adianta renovar. */
  | { tipo: 'falha' }
  | { tipo: 'altura'; altura: number };

/**
 * Lê o que a página do WebView mandou por `postMessage`. Qualquer coisa fora do combinado (não é JSON, tipo
 * desconhecido, token vazio ou acima de 2048 caracteres, altura que não é número) vira `null` e é ignorada.
 */
export function lerMensagemDoWidget(bruto: unknown): MensagemDoWidget | null {
  if (typeof bruto !== 'string' || bruto.length === 0 || bruto.length > MENSAGEM_MAXIMA) {
    return null;
  }
  let dados: unknown;
  try {
    dados = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) {
    return null;
  }
  const { tipo, token, altura } = dados as { tipo?: unknown; token?: unknown; altura?: unknown };
  switch (tipo) {
    case 'token':
      return typeof token === 'string' && token.length > 0 && token.length <= TOKEN_MAXIMO ? { tipo, token } : null;
    case 'expirou':
    case 'erro':
    case 'falha':
      return { tipo };
    case 'altura':
      return typeof altura === 'number' && Number.isFinite(altura) && altura > 0
        ? { tipo, altura: Math.min(Math.max(Math.ceil(altura), ALTURA_INICIAL), ALTURA_MAXIMA) }
        : null;
    default:
      return null;
  }
}

export interface ReacaoAoWidget {
  /** Contagem de erros seguidos depois desta mensagem. */
  falhas: number;
  /** `string` = token novo, `null` = o token que a tela tinha não vale mais, `undefined` = não mexe. */
  token?: string | null;
  /** Pedir um desafio novo (`reset`) depois de `atrasoMs`. */
  renovar: boolean;
  atrasoMs: number;
  /** Desistiu: mostrar "Não foi possível carregar..." com "Tentar de novo". */
  falhou: boolean;
  altura?: number;
}

/**
 * Decide o que fazer com cada aviso do widget (o mesmo para o WebView e para a web). Token expirado ou desafio com tempo
 * esgotado: some o token e renova na hora. Erro: renova com espera crescente, mas desiste depois de
 * {@link LIMITE_DE_FALHAS_SEGUIDAS} erros seguidos (hostname não cadastrado, chave errada) em vez de repetir para sempre.
 */
export function reagirAoWidget(mensagem: MensagemDoWidget, falhasAntes: number): ReacaoAoWidget {
  switch (mensagem.tipo) {
    case 'token':
      return { falhas: 0, token: mensagem.token, renovar: false, atrasoMs: 0, falhou: false };
    case 'expirou':
      return { falhas: falhasAntes, token: null, renovar: true, atrasoMs: 0, falhou: false };
    case 'erro': {
      const falhas = falhasAntes + 1;
      const desistir = falhas > LIMITE_DE_FALHAS_SEGUIDAS;
      return { falhas, token: null, renovar: !desistir, atrasoMs: desistir ? 0 : 1000 * falhas, falhou: desistir };
    }
    case 'falha':
      return { falhas: falhasAntes, token: null, renovar: false, atrasoMs: 0, falhou: true };
    case 'altura':
      return { falhas: falhasAntes, renovar: false, atrasoMs: 0, falhou: false, altura: mensagem.altura };
  }
}

function temaValido(tema: unknown): TemaDoWidget {
  return tema === 'dark' ? 'dark' : 'light';
}

/** JSON seguro para ficar dentro de um `<script>`: nunca fecha a tag nem abre comentário. */
export function jsonParaScript(valor: string): string {
  return JSON.stringify(valor).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * Página do WebView (celular). `null` se a chave não casa com {@link siteKeyValida}: nada é montado com chave estranha.
 * A chave entra só como string JSON; a origem (`baseUrl`) NÃO vai aqui, é passada ao WebView à parte.
 * Avisa o app por `ReactNativeWebView.postMessage` com `{tipo:'token',token}`, `{tipo:'expirou'}`, `{tipo:'erro'}`,
 * `{tipo:'falha'}` e `{tipo:'altura',altura}`; o app renova o desafio chamando `window.renovarWidget()`.
 */
export function htmlDoWidget(siteKey: unknown, tema: unknown): string | null {
  if (!siteKeyValida(siteKey)) {
    return null;
  }
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}#w{width:100%}</style>
</head>
<body>
<div id="w"></div>
<script>
(function () {
  var CHAVE = ${jsonParaScript(siteKey)};
  var TEMA = ${jsonParaScript(temaValido(tema))};
  var id = null;
  function avisar(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  function altura() {
    var h = Math.ceil(document.getElementById('w').getBoundingClientRect().height);
    if (h > 0) { avisar({ tipo: 'altura', altura: h }); }
  }
  window.renovarWidget = function () { if (window.turnstile && id !== null) { window.turnstile.reset(id); } };
  window.falhouScript = function () { avisar({ tipo: 'falha' }); };
  window.iniciarWidget = function () {
    try {
      id = window.turnstile.render('#w', {
        sitekey: CHAVE,
        theme: TEMA,
        size: 'flexible',
        language: 'pt-br',
        retry: 'never',
        'refresh-expired': 'manual',
        'refresh-timeout': 'manual',
        callback: function (token) { avisar({ tipo: 'token', token: token }); },
        'expired-callback': function () { avisar({ tipo: 'expirou' }); },
        'timeout-callback': function () { avisar({ tipo: 'expirou' }); },
        'error-callback': function () { avisar({ tipo: 'erro' }); return true; }
      });
      if (window.ResizeObserver) { new ResizeObserver(altura).observe(document.getElementById('w')); }
      altura();
    } catch (e) { avisar({ tipo: 'falha' }); }
  };
})();
</script>
<script src="${URL_DO_SCRIPT_TURNSTILE}" async defer onload="iniciarWidget()" onerror="falhouScript()"></script>
</body>
</html>`;
}

/**
 * O WebView só pode abrir uma página em branco (ou o `srcdoc` do próprio widget), a origem do widget e os hosts da Cloudflare (o iframe do desafio);
 * qualquer outra navegação é bloqueada. Sem `URL` (o do React Native não tem `hostname`): análise por texto.
 */
export function navegacaoPermitida(url: unknown): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  // about:srcdoc: iframe interno que o widget pode abrir no iOS; o conteúdo vem da própria página (já confiável).
  if (url === 'about:blank' || url === 'about:srcdoc') {
    return true;
  }
  const autoridade = /^https:\/\/([^/?#]*)/i.exec(url)?.[1];
  if (autoridade === undefined) {
    return false;
  }
  const host = /^([0-9a-z.-]+)(?::443)?$/i.exec(autoridade)?.[1]?.toLowerCase();
  if (host === undefined) {
    return false;
  }
  return host === HOST_DA_ORIGEM || host === HOST_DO_DESAFIO || host.endsWith(`.${HOST_DO_DESAFIO}`);
}

/** Erro HTTP que invalida o widget: só da página ou do script do Turnstile (um 404 de favicon não derruba nada). */
export function erroHttpFatalDoWidget(url: unknown, status: unknown): boolean {
  if (typeof url !== 'string' || typeof status !== 'number' || status < 400) {
    return false;
  }
  return url === ORIGEM_DO_WIDGET || url === `${ORIGEM_DO_WIDGET}/` || url.startsWith(`https://${HOST_DO_DESAFIO}/turnstile/v0/api.js`);
}

/** Verificação ligada e sem token: o envio espera (o botão fica desabilitado, e o Enter nos campos também não envia). */
export function aguardandoVerificacao(exigida: boolean, token: string | null): boolean {
  return exigida && !token;
}

/** Rótulo do botão de envio: "Verificando…" enquanto espera o token (e o envio em curso mostra o próprio spinner). */
export function rotuloDoEnvio(rotulo: string, aguardando: boolean, enviando: boolean): string {
  return aguardando && !enviando ? TEXTO_VERIFICANDO : rotulo;
}

/** 400 `VERIFICACAO_HUMANA`: token ausente ou recusado (renovar o widget e conferir a configuração). */
export function falhaDeVerificacao(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && (erro as { codigo?: unknown }).codigo === 'VERIFICACAO_HUMANA';
}

/** Texto fixo para o 400 de verificação (o 503 `VERIFICACAO_INDISPONIVEL` usa a mensagem do servidor); `null` nos outros erros. */
export function mensagemDaVerificacao(erro: unknown): string | null {
  return falhaDeVerificacao(erro) ? TEXTO_NAO_CONFIRMOU : null;
}
