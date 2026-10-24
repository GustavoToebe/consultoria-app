import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  MENSAGEM_SEM_CONEXAO,
  ErroApi,
  cabecalhosDeCredencial,
  caminhoDaApi,
  comRenovacao,
  corpoDoErro,
  desfechoDoRefresh,
  deveRenovar,
  erroApiDaResposta,
  lerCookie as lerCookieDoTexto,
  umaPorVez,
} from '@plataforma/web';

import { apagarRefresh, lerRefresh, salvarRefresh } from '../sessao/armazenamentoSeguro';
import type { LoginResponse } from './tipos';

export { ErroApi };

/**
 * Cliente HTTP da API.
 * - Token, cookies e XSRF só vão para a própria API (`caminhoDaApi`).
 * - Web: access token em memória, refresh no cookie HttpOnly, `credentials: 'include'` e header XSRF.
 * - Nativo: access em memória, refresh no SecureStore e no corpo, `credentials: 'omit'`.
 * - 401: um único refresh compartilhado; repete a requisição uma vez. Refresh recusado (401/403): sessão encerrada.
 * A lógica de sessão (destino, XSRF, renovação, leitura do erro) é do `@plataforma/web`; aqui ficam só o `fetch`, o
 * timeout, a plataforma, o SecureStore e o que é deste app (cookie XSRF, cabeçalho, códigos que não renovam).
 */

const WEB = Platform.OS === 'web';
const TIMEOUT_MS = 15000;
const COOKIE_XSRF = 'TREINOS-XSRF-TOKEN';

export const API_URL = resolverApiUrl();

function resolverApiUrl(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL;
  if (configurada) {
    return configurada.replace(/\/+$/, '');
  }
  if (WEB) {
    // Servido pelo Caddy: mesma origem. No `expo start --web` (Metro na 8081), a API do Docker fica na 8088.
    if (typeof window !== 'undefined' && window.location.port === '8081') {
      return `${window.location.protocol}//${window.location.hostname}:8088/api`;
    }
    return '/api';
  }
  // Expo Go em desenvolvimento: mesmo host do Metro, porta do Caddy.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8088/api`;
}

/** Base para resolver URLs relativas: a página na web; a própria API no nativo. */
function base(): string {
  return WEB && typeof window !== 'undefined' ? window.location.origin : API_URL;
}

let accessToken: string | null = null;
let aoEncerrarSessao: (() => void) | null = null;
/** Quem está com a sessão aberta nesta aba; a renovação que devolve outra pessoa não é aceita. */
let usuarioEsperado: string | null = null;
let recusaPorTroca = false;

/** O SessaoProvider é avisado quando o refresh falha no meio do uso. */
export function aoEncerrar(callback: (() => void) | null) {
  aoEncerrarSessao = callback;
}

export async function guardarSessao(resposta: LoginResponse): Promise<void> {
  accessToken = resposta.accessToken;
  if (!WEB && resposta.refreshToken) {
    await salvarRefresh(resposta.refreshToken);
  }
}

/**
 * Na web o cookie de renovação é um só por navegador: entrar com outra conta em outra aba troca a sessão desta. Sem
 * conferir, a aba do aluno renovava como treinador e as rotas do aluno respondiam 403 ("Seu perfil não permite esta
 * ação"). O SessaoProvider diz quem abriu a sessão; a renovação de outra pessoa vira recusa.
 */
export function definirUsuarioDaSessao(id: string | null) {
  usuarioEsperado = id;
}

/** A última recusa foi porque a renovação devolveu outra pessoa (lê e zera). */
export function recusadaPorTrocaDeUsuario(): boolean {
  const houve = recusaPorTroca;
  recusaPorTroca = false;
  return houve;
}

export async function limparSessaoLocal(): Promise<void> {
  accessToken = null;
  await apagarRefresh();
}

/**
 * Origem do próprio site (sem `/api`), de onde saem os arquivos públicos como as fotos do catálogo. Na web vazia
 * quando a API é `/api` (o caminho relativo fica na mesma origem); no celular, o host de `EXPO_PUBLIC_API_URL`.
 */
export function origemDoSite(): string {
  return API_URL.replace(/\/api$/, '');
}

export function urlDaApi(caminho: string): string {
  return `${API_URL}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}

/** Erros de regra de negócio: nunca disparam refresh nem repetição automática. */
const CODIGOS_SEM_REPETICAO = [
  'CONFLITO_EDICAO',
  'PLANO_INVALIDO',
  'CONFIRMAR_AVISOS',
  'MFA_CODIGO_INVALIDO',
  'MFA_SENHA_INVALIDA',
];

export interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  /** Corpo já pronto (texto CSV, FormData). */
  corpoBruto?: BodyInit;
  tipoConteudo?: string;
  /** Rotas de sessão (login, refresh...) não tentam renovar no 401. */
  semRenovar?: boolean;
  /** A resposta é uma imagem: devolve o `Blob` em vez de JSON (erros continuam vindo em JSON). */
  binario?: boolean;
  /** Prazo da chamada; o padrão é de 15 s (envio de foto em rede lenta pede mais). */
  limiteMs?: number;
  /** Ignora o cache HTTP do navegador (a configuração pública vem com `max-age`; a conferência depois de um 400 precisa da atual). */
  semCache?: boolean;
  /** Tipo aceito na resposta, quando não é JSON (CSV de exportação). Erros continuam vindo em JSON. */
  aceita?: string;
}

export async function requisicao<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  // Também sem access em memória: a sessão pode ter aberto sem internet e ter refresh guardado.
  const resposta = await comRenovacao(() => enviar(caminho, opcoes), {
    deveRenovar: async (r) => {
      if (r.status !== 401 || opcoes.semRenovar) {
        return false;
      }
      const { codigo } = corpoDoErro(await lerCorpo(r.clone()), r.status);
      return deveRenovar({ status: r.status, codigo }, { codigosSemRenovar: CODIGOS_SEM_REPETICAO });
    },
    renovar: async () => (await renovarSessao()) !== null,
    aoEncerrar: () => aoEncerrarSessao?.(),
  });
  return tratar<T>(resposta, opcoes);
}

const NOME_TRAVA_RENOVACAO = 'treinos:renovacao';

/** O que o cliente usa do `navigator.locks` (Web Locks API). */
interface GerenteDeTravas {
  request<T>(nome: string, tarefa: () => Promise<T>): Promise<T>;
}

/**
 * Na web, o cookie de renovação é um só por navegador e gira a cada refresh; duas abas renovando ao mesmo tempo
 * mandam o mesmo cookie, e a segunda conta como reuso (todas as sessões caem). Com a trava, a aba que chega depois
 * espera a primeira gravar o cookie novo e manda o refresh já rotacionado. Sem `navigator.locks` (e no nativo, que tem
 * um só processo) segue direto.
 */
function entreAbas<T>(tarefa: () => Promise<T>): Promise<T> {
  const travas = WEB && typeof navigator !== 'undefined' ? (navigator as { locks?: GerenteDeTravas }).locks : undefined;
  return travas ? travas.request(NOME_TRAVA_RENOVACAO, tarefa) : tarefa();
}

const renovacaoCompartilhada = umaPorVez(() => entreAbas(fazerRefresh));

/**
 * Um refresh por vez: chamadas simultâneas da aba esperam o mesmo e, na web, as outras abas esperam a vez. Devolve a sessão nova, `null` se o servidor recusou
 * (sessão encerrada) e lança {@link ErroApi} com `semConexao` se não deu para falar com o servidor.
 */
export function renovarSessao(): Promise<LoginResponse | null> {
  return renovacaoCompartilhada();
}

async function fazerRefresh(): Promise<LoginResponse | null> {
  let corpo: unknown;
  if (WEB) {
    await garantirXsrf();
  } else {
    const refresh = await lerRefresh();
    if (!refresh) {
      return null;
    }
    corpo = { refreshToken: refresh };
  }
  const resposta = await enviar('/auth/refresh', { metodo: 'POST', corpo, semRenovar: true });
  if (desfechoDoRefresh(resposta.status) === 'encerrar') {
    await limparSessaoLocal();
    return null;
  }
  // 429 (limite por IP) e 5xx não encerram a sessão: o servidor não recusou a credencial, só não atendeu agora. Saem
  // como "sem conexão" (status 0) com a mensagem do servidor, para a abertura do app seguir com o perfil salvo e tentar
  // de novo em 30 s, como sem internet. Antes a abertura caía em "Entrar" sem aviso (e a sessão ainda valia).
  if (resposta.status === 429 || resposta.status >= 500) {
    const erro = erroApiDaResposta(resposta.status, await lerCorpo(resposta));
    throw new ErroApi(0, erro.codigo, erro.message);
  }
  const sessao = await tratar<LoginResponse>(resposta);
  if (usuarioEsperado && sessao.usuario?.id && sessao.usuario.id !== usuarioEsperado) {
    recusaPorTroca = true;
    accessToken = null;
    return null;
  }
  await guardarSessao(sessao);
  return sessao;
}

/** O cookie XSRF é de sessão do navegador: depois de fechar e abrir, pede um novo antes do refresh. */
async function garantirXsrf(): Promise<void> {
  if (!cookieXsrf()) {
    await enviar('/actuator/health', { semRenovar: true });
  }
}

async function enviar(caminho: string, opcoes: Opcoes): Promise<Response> {
  const url = urlDaApi(caminho);
  const daApi = caminhoDaApi(url, API_URL, base()) !== null;
  const headers: Record<string, string> = {
    // Imagem: o erro continua vindo em JSON, então o servidor precisa aceitar os dois tipos.
    Accept: opcoes.binario ? 'image/jpeg, application/zip, application/json' : opcoes.aceita ? `${opcoes.aceita}, application/json` : 'application/json',
    'X-Treinos-Cliente': WEB ? 'web' : 'nativo',
  };
  let body: BodyInit | undefined;
  if (opcoes.corpoBruto !== undefined) {
    body = opcoes.corpoBruto;
    if (opcoes.tipoConteudo) {
      headers['Content-Type'] = opcoes.tipoConteudo;
    }
  } else if (opcoes.corpo !== undefined) {
    body = JSON.stringify(opcoes.corpo);
    headers['Content-Type'] = 'application/json';
  }
  if (daApi) {
    Object.assign(headers, cabecalhosDeCredencial({ token: accessToken, xsrf: cookieXsrf(), metodo: opcoes.metodo ?? 'GET' }));
  }
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), opcoes.limiteMs ?? TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: opcoes.metodo ?? 'GET',
      headers,
      body,
      credentials: WEB && daApi ? 'include' : 'omit',
      ...(opcoes.semCache ? { cache: 'no-store' as const } : {}),
      signal: controle.signal,
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', MENSAGEM_SEM_CONEXAO);
  } finally {
    clearTimeout(limite);
  }
}

async function tratar<T>(resposta: Response, opcoes: Opcoes = {}): Promise<T> {
  if (resposta.ok) {
    if (resposta.status === 204) {
      return undefined as T;
    }
    if (opcoes.binario) {
      return (await resposta.blob()) as T;
    }
    const tipo = resposta.headers.get('Content-Type') ?? '';
    return (tipo.includes('application/json') ? await resposta.json() : await resposta.text()) as T;
  }
  throw erroApiDaResposta(resposta.status, await lerCorpo(resposta));
}

/** Corpo JSON da resposta; `undefined` se não é JSON (o pacote cai no texto padrão do status). */
async function lerCorpo(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json();
  } catch {
    return undefined;
  }
}

function cookieXsrf(): string | null {
  return WEB && typeof document !== 'undefined' ? lerCookieDoTexto(document.cookie, COOKIE_XSRF) : null;
}
