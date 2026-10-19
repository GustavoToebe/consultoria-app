import type { Page, Route } from '@playwright/test';

import type { EuResponse, LoginResponse, Marca, UsuarioResumo } from '../src/api/tipos';

/**
 * API falsa dos testes de tela (`page.route` em `/api/**`, a mesma origem da web servida). As respostas vão por
 * `MÉTODO /caminho` relativo à API (`GET /eu`, `POST /inscricoes/{id}/aceitar`); `{x}` casa um segmento. O que não
 * estiver no mapa responde 404 no formato do `ApiError` e entra em `naoTratadas`, para o teste mostrar o que faltou
 * simular. Pedidos para fora da origem são abortados (nada sai da máquina). Só dados fictícios.
 */
export type Resposta =
  | { status?: number; corpo?: unknown }
  | ((pedido: PedidoFalso, route: Route) => Promise<void> | void);

export interface PedidoFalso {
  metodo: string;
  caminho: string;
  busca: URLSearchParams;
  corpo: unknown;
}

export type RespostasApi = Record<string, Resposta>;

export const MARCA: Marca = {
  id: 'c0000000-0000-4000-8000-000000000001',
  nome: 'Equipe Teste',
  corPrimaria: '#B91C1C',
  fonteTitulo: 'PADRAO',
  temaPadrao: 'CLARO',
  logoUrl: null,
};

export const TREINADOR: UsuarioResumo = {
  id: 'u0000000-0000-4000-8000-000000000001',
  nome: 'Treinadora Teste',
  email: 'treinadora@exemplo.test',
  papel: 'TREINADOR',
};

export const ALUNO: UsuarioResumo = {
  id: 'u0000000-0000-4000-8000-000000000002',
  nome: 'Aluno Teste',
  email: 'aluno@exemplo.test',
  papel: 'ALUNO',
};

/** Permissões do perfil Treinador que as telas testadas usam. */
export const PERMISSOES_TREINADOR = [
  'PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR',
  'INSCRICAO_LER', 'INSCRICAO_ALTERAR', 'ANAMNESE_LER', 'ANAMNESE_ALTERAR', 'QUESTIONARIO_LER',
];

export function erroApi(status: number, mensagem: string, codigo: string | null = null) {
  return { status, corpo: { status, message: mensagem, codigo, fieldErrors: [] } };
}

function casar(rota: string, chave: string): boolean {
  const re = new RegExp(`^${rota.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`);
  return re.test(chave);
}

/**
 * Liga a API falsa na página. Devolve os pedidos recebidos (para conferir corpo e quantidade), os não simulados e as exceções da página.
 * `/actuator/health` e `/publico/configuracao` (verificação humana desligada) já vêm prontos; sem sessão, o refresh é
 * recusado (401) e a web abre como anônima.
 */
export async function simularApi(page: Page, respostas: RespostasApi = {}) {
  const naoTratadas: string[] = [];
  const pedidos: PedidoFalso[] = [];
  /** Exceções não tratadas na página (tela branca costuma ser isto). */
  const errosDaPagina: string[] = [];
  page.on('pageerror', (erro) => errosDaPagina.push(erro.stack ?? erro.message));
  const mapa: RespostasApi = {
    'GET /actuator/health': { corpo: { status: 'UP' } },
    'GET /publico/configuracao': { corpo: { verificacaoHumana: false, siteKey: '', cadastroAberto: false } },
    'POST /auth/refresh': erroApi(401, 'Sessão expirada.'),
    ...respostas,
  };
  const rotas = Object.keys(mapa).sort((a, b) => b.length - a.length);
  await page.route((url) => url.hostname !== 'localhost', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace(/^\/api/, '');
    const chave = `${req.method()} ${caminho}`;
    let corpo: unknown = null;
    try {
      corpo = req.postDataJSON();
    } catch {
      corpo = req.postData();
    }
    const pedido: PedidoFalso = { metodo: req.method(), caminho, busca: url.searchParams, corpo };
    pedidos.push(pedido);
    const rota = rotas.find((r) => r === chave) ?? rotas.find((r) => casar(r, chave));
    const r = rota ? mapa[rota] : undefined;
    if (typeof r === 'function') return r(pedido, route);
    if (!r) naoTratadas.push(chave);
    const { status = 200, corpo: resposta = undefined } = r ?? erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO');
    if (status === 204 || resposta === undefined) return route.fulfill({ status: status === 200 ? 204 : status });
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(resposta) });
  });
  return { naoTratadas, pedidos, errosDaPagina };
}

/** Responde JSON a partir de uma função de pedido (atalho para `route.fulfill`). */
export function json(route: Route, corpo: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
}

/**
 * Sessão aberta como na volta ao app: o refresh (cookie, na web) devolve a sessão e o `/eu` traz o perfil com os termos
 * aceitos. O passeio do primeiro acesso fica marcado como visto, para não cobrir a tela.
 */
export async function sessao(page: Page, usuario: UsuarioResumo, extra: Partial<EuResponse> = {}): Promise<RespostasApi> {
  await page.addInitScript((id) => {
    localStorage.setItem(`treinos:${id}:passeioVisto`, '1');
  }, usuario.id);
  const login: LoginResponse = { accessToken: 'token-falso', expiresIn: 900, usuario, marca: MARCA };
  const eu: EuResponse = {
    usuario,
    marca: MARCA,
    termosPendentes: false,
    termosVersao: '2026-10',
    ...(usuario.papel === 'TREINADOR'
      ? { perfil: { id: 'p1', nome: 'Treinador', acessoTotal: false }, permissoes: PERMISSOES_TREINADOR }
      : { aluno: { id: 'a0000000-0000-4000-8000-000000000002', nome: usuario.nome } }),
    ...extra,
  };
  return { 'POST /auth/refresh': { corpo: login }, 'GET /eu': { corpo: eu } };
}
