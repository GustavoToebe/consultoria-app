import type { Page, Route } from '@playwright/test';

import type { EuResponse, Exercicio, LoginResponse, Marca, PesoSugeridoDaPasta, PlanoPuladoNaCopia, PlanoResumo, TipoPlano, UsuarioResumo } from '../src/api/tipos';

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

export function erroApi(status: number, mensagem: string, codigo: string | null = null, fieldErrors: { field: string; message: string }[] = []) {
  return { status, corpo: { status, message: mensagem, codigo, fieldErrors } };
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
    // O app do aluno busca as séries já gravadas no servidor ao abrir; sem histórico nos testes.
    'GET /aluno/execucoes': { corpo: [] },
    // Idem para os itens de mobilidade já marcados no servidor.
    'GET /aluno/mobilidade/registros': { corpo: [] },
    // Imagens dos exercícios do plano (própria ou do catálogo); nenhuma nos testes que não conferem isso.
    'GET /aluno/exercicios/demonstracoes': { corpo: [] },
    // O ponto da aba do aluno pergunta pela anamnese; 404 = nenhuma atribuída (o teste da anamnese troca).
    'GET /aluno/anamnese': erroApi(404, 'Nenhuma anamnese.', 'NAO_ENCONTRADO'),
    // O cartão "Meu perfil" da Conta e o aviso da Comunidade leem isto; visível por escolha (sem aviso) e sem conquistas.
    'GET /aluno/comunidade/perfil': { corpo: { perfilReservado: false, reservadoEfetivo: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES', opcoesDeDestaque: [] } },
    // A faixa do ciclo na pasta e nos editores do aluno consulta isto; desligado não desenha nada.
    'GET /alunos/{id}/ciclo': { corpo: { ativo: false, registros: [], dias: [] } },
    // "Atividade recente" do Resumo da ficha: vazia nos testes que não conferem isso.
    'GET /alunos/{id}/atividade-recente': { corpo: { itens: [] } },
    // O número das abas de Atualizações (os mesmos filtros da lista); zero nos testes que não conferem isso.
    'GET /atualizacoes/contagens': { corpo: { PARA_REVISAR: 0, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } },
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

/** O que fica gravado no aparelho antes de a página abrir (ver {@link sessao}). */
export interface AparelhoFalso {
  /** Marca o passeio do primeiro acesso como visto (padrão). `false`: o passeio abre, como no primeiro acesso. */
  passeioVisto?: boolean;
  /**
   * Estado dos Primeiros passos do Início (`treinos:<id>:primeirosPassos`). Padrão `{"dispensado":true}`: o bloco não
   * cobre o Início nem faz consultas a mais. `null`: não grava nada (o bloco aparece, como no primeiro uso).
   */
  primeirosPassos?: string | null;
}

/**
 * Sessão aberta como na volta ao app: o refresh (cookie, na web) devolve a sessão e o `/eu` traz o perfil com os termos
 * aceitos. O passeio do primeiro acesso fica marcado como visto, para não cobrir a tela, e os Primeiros passos do Início
 * ficam dispensados (`aparelho` muda os dois). Só grava o que ainda não existe: recarregar a página mantém o que a tela
 * gravou (o teste de "Já conferi" depois de recarregar).
 */
export async function sessao(page: Page, usuario: UsuarioResumo, extra: Partial<EuResponse> = {}, aparelho: AparelhoFalso = {}): Promise<RespostasApi> {
  const primeirosPassos = aparelho.primeirosPassos === undefined ? JSON.stringify({ dispensado: true }) : aparelho.primeirosPassos;
  await page.addInitScript(({ id, passeio, passos }) => {
    if (passeio) localStorage.setItem(`treinos:${id}:passeioVisto`, '1');
    const chave = `treinos:${id}:primeirosPassos`;
    if (passos !== null && localStorage.getItem(chave) === null) localStorage.setItem(chave, passos);
  }, { id: usuario.id, passeio: aparelho.passeioVisto !== false, passos: primeirosPassos });
  const login: LoginResponse = { accessToken: 'token-falso', expiresIn: 900, usuario, marca: MARCA };
  const eu: EuResponse = {
    usuario,
    marca: MARCA,
    termosPendentes: false,
    termosVersao: '2026-10',
    // As chaves da plataforma do "Pagar" no celular vêm sempre no /eu (padrão desligadas); a web não depende delas.
    pagarNoIos: false,
    pagarNoAndroid: false,
    // "Concluir treino" vem desligado; o teste que o usa liga por `extra`.
    retornoHabilitado: false,
    // A escolha de kg/lb vem desligada; o teste que a usa liga por `extra`.
    unidadeDeCargaHabilitada: false,
    ...(usuario.papel === 'TREINADOR'
      ? { perfil: { id: 'p1', nome: 'Treinador', acessoTotal: false }, permissoes: PERMISSOES_TREINADOR }
      : { aluno: { id: 'a0000000-0000-4000-8000-000000000002', nome: usuario.nome } }),
    ...extra,
  };
  // O Início do treinador conta os interessados novos e os retornos pelas contagens da fila (zeradas aqui; o teste que
  // precisa de outro número a substitui).
  const contagens: RespostasApi = usuario.papel === 'TREINADOR'
    ? { 'GET /inscricoes/contagens': { corpo: { porSituacao: {}, abertas: 0, todas: 0, retornosAtrasados: 0, retornosHoje: 0 } } }
    : {};
  return { 'POST /auth/refresh': { corpo: login }, 'GET /eu': { corpo: eu }, ...contagens };
}

/** Um plano da pasta simulada, com o tipo (o `PlanoResumo` não o traz). Mutável: publicar muda a versão. */
export interface PlanoDaPastaFalsa {
  tipo: TipoPlano;
  plano: PlanoResumo;
}

/** O que a pasta simulada responde em "Publicar tudo", "Copiar pasta para outro aluno" e "peso sugerido". */
export interface PastaFalsa {
  alunoId: string;
  pastaId: string;
  planos: PlanoDaPastaFalsa[];
  /** As permissões da sessão: a de publicar só é pedida dos tipos com alteração (403 e nada publicado). */
  permissoes: readonly string[];
  /** Problemas da validação de cada plano, com o campo já no formato da API (`dieta.<caminho>`). */
  erros?: { field: string; message: string }[];
  avisos?: { field: string; message: string }[];
  /** `null` = sem peso na atualização; `'erro'` = a rota falha (500). */
  pesoSugerido?: PesoSugeridoDaPasta | 'erro';
  /** Resposta da cópia: sucesso (padrão) ou um erro da API. */
  copia?: { status: number; codigo: string | null; mensagem: string };
  /** `pulados` da resposta da cópia (padrão: nenhum). */
  copiaPulados?: PlanoPuladoNaCopia[];
  /**
   * Ids de planos que "outra pessoa salvou" depois de a tela ler a lista: no primeiro "Publicar tudo" a versão deles sobe
   * antes da conferência (a tela mandou a velha, 409 `CONFLITO_EDICAO`) e as listas seguintes já trazem a nova.
   */
  outraPessoaSalvou?: string[];
  /** Tipos cuja lista de planos falha (500) nas primeiras chamadas e depois responde normal (o "Tentar de novo"). */
  listaFalhaNaPrimeiraVez?: TipoPlano[];
}

const PERMISSAO_DE_PUBLICAR: Record<TipoPlano, string> = { treino: 'TREINO_PUBLICAR', dieta: 'DIETA_PUBLICAR', mobilidade: 'TREINO_PUBLICAR' };
const PERMISSAO_DE_LER: Record<TipoPlano, string> = { treino: 'TREINO_LER', dieta: 'DIETA_LER', mobilidade: 'TREINO_LER' };
const PREFIXO_DAS_ROTAS: Record<TipoPlano, string> = { treino: 'planos-treino', dieta: 'planos-dieta', mobilidade: 'planos-mobilidade' };

/**
 * Rotas da pasta como a API (commit 797b9751 com o ajuste de 02/11 e os itens 1 a 5 da revisão): as listas de planos do
 * aluno e `POST /pastas/{id}/publicar` tudo ou nada, na ordem da API: `versoes` obrigatório (400) → permissão de publicar
 * só dos tipos com alteração (403) → dois pendentes do mesmo tipo (409 `PLANOS_PENDENTES_DUPLICADOS`, tipo em
 * `fieldErrors[].field` e id do plano na mensagem) → versão de cada pendente igual à `versao` do plano, ausente ou
 * diferente = 409 `CONFLITO_EDICAO` → erro em qualquer plano (422 `PLANO_INVALIDO`) → aviso sem `confirmarAvisos` (422
 * `CONFIRMAR_AVISOS`); em todos nada muda. `pulados` só traz tipos que a sessão lê. Também a cópia para outro aluno
 * (com `pulados`) e o peso sugerido. Plano com alteração = nunca publicado ou rascunho alterado depois da última publicação.
 */
export function rotasDaPasta(p: PastaFalsa): RespostasApi {
  const pendente = (x: PlanoDaPastaFalsa) => x.plano.versaoPublicada === 0 || x.plano.rascunhoAlteradoDepoisDePublicar;
  const aindaFalha = new Set(p.listaFalhaNaPrimeiraVez ?? []);
  const lista = (tipo: TipoPlano): Resposta => (_pedido, route) => {
    if (aindaFalha.delete(tipo)) {
      const e = erroApi(500, 'Erro.');
      return json(route, e.corpo, e.status);
    }
    return json(route, p.planos.filter((x) => x.tipo === tipo).map((x) => x.plano));
  };
  let jaSalvaramPorFora = false;
  return {
    [`GET /alunos/${p.alunoId}/${PREFIXO_DAS_ROTAS.treino}`]: lista('treino'),
    [`GET /alunos/${p.alunoId}/${PREFIXO_DAS_ROTAS.dieta}`]: lista('dieta'),
    [`GET /alunos/${p.alunoId}/${PREFIXO_DAS_ROTAS.mobilidade}`]: lista('mobilidade'),
    [`POST /pastas/${p.pastaId}/publicar`]: (pedido, route) => {
      const corpo = pedido.corpo as { confirmarAvisos?: boolean; versoes?: Record<string, number> } | null;
      const confirmar = corpo?.confirmarAvisos === true;
      if (!corpo?.versoes || typeof corpo.versoes !== 'object') {
        const e = erroApi(400, 'Informe as versões dos planos.', 'REQUISICAO_INVALIDA', [{ field: 'versoes', message: 'não deve ser nulo' }]);
        return json(route, e.corpo, e.status);
      }
      // A outra pessoa salva depois de a tela ler a lista e antes deste pedido (uma vez só).
      if (!jaSalvaramPorFora && p.outraPessoaSalvou?.length) {
        jaSalvaramPorFora = true;
        for (const x of p.planos) if (p.outraPessoaSalvou.includes(x.plano.id)) x.plano = { ...x.plano, versao: x.plano.versao + 1 };
      }
      const aPublicar = p.planos.filter(pendente);
      if (aPublicar.some((x) => !p.permissoes.includes(PERMISSAO_DE_PUBLICAR[x.tipo]))) {
        const e = erroApi(403, 'Sem permissão.', 'PERMISSAO_NEGADA');
        return json(route, e.corpo, e.status);
      }
      const repetidos = (['treino', 'dieta', 'mobilidade'] as const).flatMap((tipo) => {
        const doTipo = aPublicar.filter((x) => x.tipo === tipo);
        return doTipo.length > 1 ? doTipo.map((x) => ({ field: tipo, message: x.plano.id })) : [];
      });
      if (repetidos.length) {
        const e = erroApi(409, 'A pasta tem mais de um plano com alteração a publicar do mesmo tipo. Nada foi publicado.', 'PLANOS_PENDENTES_DUPLICADOS', repetidos);
        return json(route, e.corpo, e.status);
      }
      if (aPublicar.some((x) => corpo.versoes?.[x.plano.id] !== x.plano.versao)) {
        const e = erroApi(409, 'Outra pessoa alterou os planos desta pasta. Recarregue e confira antes de publicar. Nada foi publicado.', 'CONFLITO_EDICAO');
        return json(route, e.corpo, e.status);
      }
      if (p.erros?.length) {
        const e = erroApi(422, 'Há planos com erros que impedem a publicação. Nada foi publicado.', 'PLANO_INVALIDO', p.erros);
        return json(route, e.corpo, e.status);
      }
      if (p.avisos?.length && !confirmar) {
        const e = erroApi(422, 'Confira os avisos antes de publicar. Nada foi publicado.', 'CONFIRMAR_AVISOS', p.avisos);
        return json(route, e.corpo, e.status);
      }
      const pulados = p.planos.filter((x) => !pendente(x) && p.permissoes.includes(PERMISSAO_DE_LER[x.tipo])).map((x) => ({ tipo: x.tipo, planoId: x.plano.id }));
      const publicados = aPublicar.map((x) => {
        x.plano = { ...x.plano, versaoPublicada: x.plano.versaoPublicada + 1, rascunhoAlteradoDepoisDePublicar: false };
        return { tipo: x.tipo, planoId: x.plano.id, versao: x.plano.versaoPublicada };
      });
      return json(route, { publicados, pulados });
    },
    [`POST /pastas/${p.pastaId}/copiar-para-aluno`]: (_pedido, route) => {
      if (p.copia) {
        const e = erroApi(p.copia.status, p.copia.mensagem, p.copia.codigo);
        return json(route, e.corpo, e.status);
      }
      return json(route, {
        pastaId: 'f0000000-0000-4000-8000-0000000000c1',
        planos: p.planos
          .filter((x) => !(p.copiaPulados ?? []).some((pulado) => pulado.tipo === x.tipo))
          .map((x) => ({ tipo: x.tipo, planoId: `copia-${x.plano.id}` })),
        pulados: p.copiaPulados ?? [],
      });
    },
    [`GET /pastas/${p.pastaId}/peso-sugerido`]: (_pedido, route) => {
      if (p.pesoSugerido === 'erro') {
        const e = erroApi(500, 'Erro.');
        return json(route, e.corpo, e.status);
      }
      return json(route, p.pesoSugerido ?? { pesoKg: null, data: null });
    },
  };
}

/**
 * `GET /exercicios/pagina` como o servidor responde: busca sem acento em nome e grupo, grupos repetidos (OU), páginas de
 * `tamanho` e `grupos` de toda a lista. Guarda cada consulta recebida em `consultas`, para o teste conferir o que a tela pediu.
 */
export function paginaDeExerciciosFalsa(todos: Exercicio[], consultas: string[] = []): Resposta {
  const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
  return (pedido, route) => {
    consultas.push(pedido.busca.toString());
    const termo = semAcento(pedido.busca.get('busca') ?? '');
    const escolhidos = pedido.busca.getAll('grupo');
    const tamanho = Number(pedido.busca.get('tamanho') ?? 30);
    const pagina = Number(pedido.busca.get('pagina') ?? 0);
    const casaram = todos.filter((e) => (escolhidos.length === 0 || escolhidos.includes(e.grupoMuscular?.trim() ?? ''))
      && (!termo || semAcento(`${e.nome} ${e.grupoMuscular ?? ''}`).includes(termo)));
    const grupos = [...new Set(todos.map((e) => e.grupoMuscular?.trim()).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return json(route, { itens: casaram.slice(pagina * tamanho, (pagina + 1) * tamanho), total: casaram.length, grupos });
  };
}
