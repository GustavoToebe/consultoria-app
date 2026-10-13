import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apagarRefresh, lerRefresh, salvarRefresh } from '../sessao/armazenamentoSeguro';
import { caminhoDaApi } from './destino-api';
import type { ApiErrorBody, CampoComErro, LoginResponse } from './tipos';

/**
 * Cliente HTTP da API.
 * - Token, cookies e XSRF só vão para a própria API (`caminhoDaApi`).
 * - Web: access token em memória, refresh no cookie HttpOnly, `credentials: 'include'` e header XSRF.
 * - Nativo: access em memória, refresh no SecureStore e no corpo, `credentials: 'omit'`.
 * - 401: um único refresh compartilhado; repete a requisição uma vez. Falhou: sessão encerrada.
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

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string | null,
    mensagem: string,
    readonly campos: CampoComErro[] = [],
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }

  /** Sem rede, servidor fora do ar ou tempo esgotado: o app continua com o que tem salvo. */
  get semConexao(): boolean {
    return this.status === 0;
  }
}

let accessToken: string | null = null;
let aoEncerrarSessao: (() => void) | null = null;
let renovando: Promise<LoginResponse | null> | null = null;

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

export async function limparSessaoLocal(): Promise<void> {
  accessToken = null;
  await apagarRefresh();
}

export function urlDaApi(caminho: string): string {
  return `${API_URL}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}

/** Erros de regra de negócio: nunca disparam refresh nem repetição automática. */
const CODIGOS_SEM_REPETICAO = new Set(['CONFLITO_EDICAO', 'PLANO_INVALIDO', 'CONFIRMAR_AVISOS']);

export interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  /** Corpo já pronto (texto CSV, FormData). */
  corpoBruto?: BodyInit;
  tipoConteudo?: string;
  /** Rotas de sessão (login, refresh...) não tentam renovar no 401. */
  semRenovar?: boolean;
}

export async function requisicao<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const resposta = await enviar(caminho, opcoes);
  // Também sem access em memória: a sessão pode ter aberto sem internet e ter refresh guardado.
  if (resposta.status === 401 && !opcoes.semRenovar) {
    const corpo = await lerErro(resposta.clone());
    if (!CODIGOS_SEM_REPETICAO.has(corpo.codigo ?? '')) {
      const renovada = await renovarSessao();
      if (renovada) {
        return tratar<T>(await enviar(caminho, opcoes));
      }
      aoEncerrarSessao?.();
    }
  }
  return tratar<T>(resposta);
}

/**
 * Um refresh por vez: chamadas simultâneas esperam o mesmo. Devolve a sessão nova, `null` se o servidor recusou
 * (sessão encerrada) e lança {@link ErroApi} com `semConexao` se não deu para falar com o servidor.
 */
export function renovarSessao(): Promise<LoginResponse | null> {
  if (!renovando) {
    renovando = fazerRefresh().finally(() => {
      renovando = null;
    });
  }
  return renovando;
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
  if (resposta.status === 401 || resposta.status === 403) {
    await limparSessaoLocal();
    return null;
  }
  const sessao = await tratar<LoginResponse>(resposta);
  await guardarSessao(sessao);
  return sessao;
}

/** O cookie XSRF é de sessão do navegador: depois de fechar e abrir, pede um novo antes do refresh. */
async function garantirXsrf(): Promise<void> {
  if (!lerCookie(COOKIE_XSRF)) {
    await enviar('/actuator/health', { semRenovar: true });
  }
}

async function enviar(caminho: string, opcoes: Opcoes): Promise<Response> {
  const url = urlDaApi(caminho);
  const daApi = caminhoDaApi(url, API_URL, base()) !== null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
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
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const xsrf = WEB ? lerCookie(COOKIE_XSRF) : null;
    if (xsrf) {
      headers['X-XSRF-TOKEN'] = xsrf;
    }
  }
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: opcoes.metodo ?? 'GET',
      headers,
      body,
      credentials: WEB && daApi ? 'include' : 'omit',
      signal: controle.signal,
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Confira a internet e tente de novo.');
  } finally {
    clearTimeout(limite);
  }
}

async function tratar<T>(resposta: Response): Promise<T> {
  if (resposta.ok) {
    if (resposta.status === 204) {
      return undefined as T;
    }
    const tipo = resposta.headers.get('Content-Type') ?? '';
    return (tipo.includes('application/json') ? await resposta.json() : await resposta.text()) as T;
  }
  const erro = await lerErro(resposta);
  throw new ErroApi(resposta.status, erro.codigo, erro.message, erro.fieldErrors ?? []);
}

async function lerErro(resposta: Response): Promise<ApiErrorBody> {
  try {
    return (await resposta.json()) as ApiErrorBody;
  } catch {
    return {
      timestamp: '',
      status: resposta.status,
      error: '',
      message: resposta.status >= 500 ? 'O servidor teve um problema. Tente de novo.' : 'Não foi possível concluir.',
      codigo: null,
      path: '',
      requestId: null,
      fieldErrors: null,
    };
  }
}

function lerCookie(nome: string): string | null {
  if (!WEB || typeof document === 'undefined') {
    return null;
  }
  for (const parte of document.cookie.split(';')) {
    const [chave, ...valor] = parte.trim().split('=');
    if (chave === nome) {
      return decodeURIComponent(valor.join('='));
    }
  }
  return null;
}
