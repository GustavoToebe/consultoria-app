import type { Page, Route } from '@playwright/test';

import type { AlunoResumo } from '../src/api/tipos';
import type {
  CobrancaAvulsaRequest, CobrancaAvulsaResponse, CobrancaDoAluno, CobrancaResponse, ConferenciaDePagamento, ContratacaoResponse, FinanceiroDoAluno, FormaDeRecebimento,
  FormasDeRecebimento, FormasDeRecebimentoRequest, Inadimplente, JurosDoParcelamento, EncerrarContratacaoRequest, LancamentoResponse, Lembretes,
  LembretesDaCobranca, Painel, PlanoResponse, PreviaDoEncerramento, RecebimentoOnline, ResumoDaSaidaDoAluno, TipoDeChavePix, VisaoGeralDoFinanceiro,
} from '../src/api/financeiroTipos';
import type { PreviaDeGeracao } from '../src/api/financeiroF1';
import type { ResponsavelFinanceiro, ResponsavelFinanceiroRequest } from '../src/api/financeiroResponsavel';
import type { PreviaDaRenegociacao, PreviaDaRenegociacaoRequest, RenegociacaoResponse, RenegociarRequest } from '../src/api/financeiroRenegociar';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * API falsa do financeiro (pagamentos do aluno ao treinador), com estado em memória: criar plano, contratar (gera a
 * primeira cobrança), dar baixa manual, lançamentos avulsos, painel e a visão do aluno (`GET /aluno/financeiro`).
 * Mesmos contratos de `PagamentosDtos`. Dinheiro em centavos; o valor da cobrança sai do plano ou da contratação,
 * nunca do corpo da baixa. Recebimento online (InfinitePay): configuração em memória (a API Key nunca é devolvida),
 * links de pagamento fictícios (`LINK_DE_PAGAMENTO`) e a lista de pagamentos para conferir. Só dados fictícios.
 */

/** O link que as rotas de link devolvem: `https` válido, mas o domínio `.invalid` nunca resolve (nenhuma rede de verdade). */
export const LINK_DE_PAGAMENTO = 'https://pagamento.exemplo.invalid/abc';

export const ALUNO_FINANCEIRO_ID = 'a0000000-0000-4000-8000-000000000002';

/** Permissões do financeiro; o módulo ligado vai em `pagamentosHabilitados` do `/eu`. */
export const PERMISSOES_FINANCEIRO = ['FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'];

/**
 * Sessão do treinador com o módulo de pagamentos ligado e as permissões do financeiro. `recebimentoOnline` liga também a
 * InfinitePay (`recebimentoOnlineHabilitado` do `/eu`); desligado, a aba e o cartão de conferência não existem.
 */
export function sessaoComFinanceiro(
  page: Page, permissoes: string[] = PERMISSOES_FINANCEIRO, recebimentoOnline = true,
): Promise<RespostasApi> {
  return sessao(page, TREINADOR, {
    pagamentosHabilitados: true,
    recebimentoOnlineHabilitado: recebimentoOnline,
    permissoes: [...PERMISSOES_TREINADOR, ...permissoes],
  });
}

export const RECEBIMENTO_NAO_CONFIGURADO: RecebimentoOnline = {
  habilitado: true, configurado: false, infiniteTag: null, apiKeyConfigurada: false, jurosDoParcelamento: null, versao: null,
};

/** Recebimento online já configurado (Tag e chave), como a API devolve: a chave nunca vem, só `apiKeyConfigurada`. */
export const RECEBIMENTO_CONFIGURADO: RecebimentoOnline = {
  habilitado: true, configurado: true, infiniteTag: 'saraiva.team', apiKeyConfigurada: true, jurosDoParcelamento: 'ALUNO', versao: 0,
};

/** Um pagamento que a InfinitePay avisou com valor diferente do da cobrança. */
export const CONFERENCIA_VALOR_DIFERENTE: ConferenciaDePagamento = {
  id: 'f0000000-0000-4000-8000-0000000000a1', alunoId: 'a0000000-0000-4000-8000-0000000000bb', alunoNome: 'Aluna Conferir',
  cobrancaId: 'c0000000-0000-4000-8000-0000000000aa', competencia: '2026-10-05', valorCobrancaCentavos: 15_000, valorPagoCentavos: 10_000,
  motivo: 'VALOR_DIFERENTE', recebidoEm: '2026-10-19T15:30:00Z',
};

/** Um pagamento já baixado que a InfinitePay informou estornado: a cobrança continua paga e o treinador decide. */
export const CONFERENCIA_ESTORNO_INFORMADO: ConferenciaDePagamento = {
  id: 'f0000000-0000-4000-8000-0000000000a3', alunoId: 'a0000000-0000-4000-8000-0000000000bb', alunoNome: 'Aluna Estorno',
  cobrancaId: 'c0000000-0000-4000-8000-0000000000ab', competencia: '2026-10-05', valorCobrancaCentavos: 15_000, valorPagoCentavos: 15_000,
  motivo: 'ESTORNO_INFORMADO', recebidoEm: '2026-10-19T16:00:00Z',
};

/** Um pagamento que não casou com nenhuma cobrança: como a API devolve, aluno, cobrança, competência e valor da cobrança nulos. */
export const CONFERENCIA_SEM_COBRANCA: ConferenciaDePagamento = {
  id: 'f0000000-0000-4000-8000-0000000000a2', alunoId: null, alunoNome: null,
  cobrancaId: null, competencia: null, valorCobrancaCentavos: null, valorPagoCentavos: 9_000,
  motivo: 'COBRANCA_NAO_ENCONTRADA', recebidoEm: '2026-10-18T12:00:00Z',
};

const ROTULO_RESULTADO = 'Resultado do mês (entradas − saídas registradas)';

/**
 * Painel de consulta válida e vazia, como a API devolve numa consultoria nova: somas e contagens em 0; nulo só onde não há
 * base (valor médio sem pagante, percentual sem nada vencido, líquido).
 */
export const PAINEL_VAZIO: Painel = {
  periodo: { de: '2026-05-01', ate: '2026-10-31' },
  somenteMeus: false,
  cartoes: {
    recebidoCentavos: 0, aReceberCentavos: 0, emAtraso: { valorCentavos: 0, cobrancas: 0 }, receitaRecorrenteMensalCentavos: 0,
    alunosPagantes: 0, valorMedioPorAlunoCentavos: null,
  },
  serie: [],
  inadimplencia: { percentual: null, vencidoCentavos: null, cobradoCentavos: null },
  porForma: [],
  porPlano: [],
  movimentoDeAlunos: [],
  proximosRecebimentos: { fonte: 'VENCIMENTO', em7Dias: { valorCentavos: 0, cobrancas: 0 }, em30Dias: { valorCentavos: 0, cobrancas: 0 } },
  resultadoDoMes: {
    rotulo: ROTULO_RESULTADO, mes: '2026-10', recebidoCentavos: 0, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0,
  },
  liquido: { disponivel: false, motivo: null, brutoCentavos: null },
};

/** Painel com números fictícios (seis meses até outubro de 2026). */
export const PAINEL_COM_DADOS: Painel = {
  ...PAINEL_VAZIO,
  cartoes: {
    recebidoCentavos: 120_000, aReceberCentavos: 45_000, emAtraso: { valorCentavos: 30_000, cobrancas: 2 },
    receitaRecorrenteMensalCentavos: 90_000, alunosPagantes: 6, valorMedioPorAlunoCentavos: 15_000,
  },
  serie: [
    { mes: '2026-08', parcial: false, recebidoCentavos: 30_000, previstoCentavos: null, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 10_000, resultadoCentavos: 20_000 },
    { mes: '2026-09', parcial: false, recebidoCentavos: 45_000, previstoCentavos: null, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 45_000 },
    { mes: '2026-10', parcial: true, recebidoCentavos: 45_000, previstoCentavos: 45_000, entradasAvulsasCentavos: 5_000, saidasAvulsasCentavos: 20_000, resultadoCentavos: 30_000 },
  ],
  inadimplencia: { percentual: 12.5, vencidoCentavos: 30_000, cobradoCentavos: 240_000 },
  porForma: [{ forma: 'PIX_DIRETO', cobrancas: 6, valorCentavos: 90_000 }, { forma: 'DINHEIRO', cobrancas: 2, valorCentavos: 30_000 }],
  porPlano: [{ planoId: 'b0000000-0000-4000-8000-0000000000f1', nome: 'Consultoria mensal', cobrancas: 8, valorCentavos: 120_000 }],
  movimentoDeAlunos: [{ mes: '2026-10', contratacoesNovas: 2, contratacoesEncerradas: 1 }],
  proximosRecebimentos: { fonte: 'VENCIMENTO', em7Dias: { valorCentavos: 15_000, cobrancas: 1 }, em30Dias: { valorCentavos: 45_000, cobrancas: 3 } },
  resultadoDoMes: {
    rotulo: ROTULO_RESULTADO, mes: '2026-10', recebidoCentavos: 45_000, entradasAvulsasCentavos: 5_000, saidasAvulsasCentavos: 20_000, resultadoCentavos: 30_000,
  },
  liquido: { disponivel: false, motivo: null, brutoCentavos: 120_000 },
};

export const INADIMPLENTE: Inadimplente = {
  cobrancaId: 'c0000000-0000-4000-8000-0000000000aa', alunoId: 'a0000000-0000-4000-8000-0000000000bb', alunoNome: 'Aluna Atrasada',
  valorCentavos: 15_000, vencimento: '2026-10-05', diasDeAtraso: 14,
};

/** A cobrança do `INADIMPLENTE`, como a ficha e a lista de cobranças a devolvem (versão 0, vencida há 14 dias). */
export const COBRANCA_ATRASADA: CobrancaResponse = {
  id: INADIMPLENTE.cobrancaId, contratacaoId: 'e0000000-0000-4000-8000-0000000000cc', alunoId: INADIMPLENTE.alunoId, alunoNome: INADIMPLENTE.alunoNome,
  planoNome: 'Consultoria mensal', competencia: '2026-10-05', vencimento: INADIMPLENTE.vencimento, valorCentavos: INADIMPLENTE.valorCentavos,
  situacao: 'ABERTA', vencida: true, diasDeAtraso: INADIMPLENTE.diasDeAtraso, forma: null, provedor: null, pagoEm: null, baixaPor: null,
  baixaPorNome: null, observacao: null, motivo: null, versao: 0, tipo: 'MENSALIDADE', descricao: null,
};

/** Estado em memória do financeiro falso: o mesmo objeto serve à página do treinador e à do aluno no mesmo teste. */
export interface EstadoFinanceiro {
  planos: PlanoResponse[];
  contratacoes: ContratacaoResponse[];
  cobrancas: CobrancaResponse[];
  lancamentos: LancamentoResponse[];
  inadimplentes: Inadimplente[];
  painel: Painel;
  /** Recebimento online do treinador; sem `versao` = ainda não configurado. */
  recebimento: RecebimentoOnline;
  /** A API Key recebida no último PUT. Fica só aqui, no falso: nenhuma resposta a devolve. */
  chaveGuardada: string | null;
  conferencias: ConferenciaDePagamento[];
  /** O que `GET /aluno/financeiro` diz: a consultoria tem recebimento online configurado e ligado. */
  pagamentoOnline: boolean;
  /** O que `POST /aluno/financeiro/retorno-pagamento` recebeu (a volta do navegador depois do pagamento). */
  retornos: unknown[];
  /** Configuração dos lembretes de cobrança por e-mail (sem `versao` = nunca salva). */
  lembretes: Lembretes;
  /** O que `GET /cobrancas/{id}/lembretes` devolve por cobrança; sem entrada = nenhum lembrete e sem WhatsApp. */
  lembretesDasCobrancas: Record<string, LembretesDaCobranca>;
  /** O que `GET /aluno/lembretes-de-cobranca` diz (o aluno quer receber os lembretes?) e os `PUT` recebidos. */
  alunoRecebeLembretes: boolean;
  /** Se preenchido, o `PUT /aluno/lembretes-de-cobranca` responde 503 com esta mensagem (o interruptor tem de voltar). */
  falhaAoDefinirLembretesDoAluno: string | null;
  pedidosDeLembretesDoAluno: unknown[];
  /** O que `GET /financeiro/visao-geral` devolve (renovações próximas); nulo = 404, e o cartão não aparece. */
  renovacoes: VisaoGeralDoFinanceiro | null;
  /** O mesmo com `?meus=true` (só os alunos do responsável); nulo = a rota devolve `renovacoes`. */
  renovacoesMeus: VisaoGeralDoFinanceiro | null;
  /**
   * Cobranças que o `POST /cobrancas/baixa-em-lote` recusa, com o código (falha parcial); as outras são baixadas como na
   * baixa manual. Os corpos recebidos ficam em `lotesRecebidos`.
   */
  recusasDoLote: Record<string, string>;
  lotesRecebidos: unknown[];
  /**
   * O que `GET /contratacoes/{id}/previa-de-encerramento` devolve por contratação; sem entrada, a prévia sem mínimo montada
   * das cobranças abertas (`previaSemMinimo`).
   */
  previas: Record<string, PreviaDoEncerramento>;
  /**
   * Preenchida: o próximo `POST /contratacoes/{id}/encerrar` com `saida` responde 409 `VALOR_DA_SAIDA_MUDOU` uma vez e a
   * prévia da contratação passa a ser esta (a conta mudou enquanto a folha estava aberta).
   */
  previaQueMuda: PreviaDoEncerramento | null;
  /** Os corpos recebidos pelo encerrar, na ordem (inclusive os recusados). */
  encerramentos: EncerrarContratacaoRequest[];
  /** O que `GET /alunos/{id}/resumo-da-saida` devolve (o painel de inativar). */
  resumoDaSaida: ResumoDaSaidaDoAluno;
  /**
   * Os alunos de `GET /alunos` (a escolha da cobrança avulsa): a lista só devolve os ativos, como o padrão da API. O
   * `POST /financeiro/cobrancas-avulsas` confere cada id aqui: fora da lista = 404, inativo = 409 `ALUNO_INATIVO`.
   */
  alunos: AlunoResumo[];
  /** Os corpos recebidos pelo `POST /financeiro/cobrancas-avulsas`, na ordem (inclusive os recusados). */
  avulsasRecebidas: CobrancaAvulsaRequest[];
  /** Os pedidos já gerados (D11), com a resposta dada: o mesmo `pedidoId` de novo responde 200 com ela, sem gerar nada. */
  avulsasGeradas: Record<string, CobrancaAvulsaResponse>;
  /** O que `GET /financeiro/formas-de-recebimento` devolve (sem `versao` = nunca gravadas: o padrão do servidor). */
  formas: FormasDeRecebimento;
  /** A chave Pix gravada (canônica). Fica só aqui, no falso: nenhuma resposta a devolve, só a máscara. */
  chavePixGuardada: string | null;
  /** Os corpos recebidos pelo `PUT /financeiro/formas-de-recebimento`, na ordem (inclusive os recusados). */
  formasRecebidas: FormasDeRecebimentoRequest[];
  /** Preenchida: o próximo `PUT` das formas responde 422 `FORMAS_INVALIDAS` com estes campos (uma vez), como o servidor faria. */
  recusaDasFormas: { field: string; message: string }[] | null;
  /** Os ids recebidos pelo `POST /aluno/financeiro/cobrancas/{id}/pix`. */
  pixPedidos: string[];
  /** O que `POST /contratacoes/previa-de-geracao` devolve (D10); a API calcula, o falso só devolve o que o teste pôs. */
  previaDeGeracao: PreviaDeGeracao;
  /** Quantas das próximas prévias respondem 500 (o "Tentar de novo"). */
  falhasDaPrevia: number;
  /** Espera antes de responder a prévia, em ms (o "Contratar plano" fica desabilitado enquanto ela carrega). */
  atrasoDaPreviaMs: number;
  /** Os corpos recebidos pela prévia, na ordem (inclusive os que falharam). */
  previasRecebidas: unknown[];
  /** Os `versao` recebidos pelo `POST /financeiro/formas-de-recebimento/pix/apagar` (D12). */
  apagarPixRecebidos: unknown[];
  /** Os corpos recebidos pela prévia e pelo confirmar do Renegociar (D14), na ordem (inclusive os recusados). */
  previasDaRenegociacao: PreviaDaRenegociacaoRequest[];
  renegociacoesRecebidas: RenegociarRequest[];
  /** Os pedidos de renegociação já feitos (idempotência): o mesmo `pedidoId` de novo responde 200 com a mesma resposta. */
  renegociacoesFeitas: Record<string, RenegociacaoResponse>;
  /** Preenchida: a próxima chamada daquela rota do Renegociar responde este erro (uma vez). */
  recusaDaRenegociacao: { rota: 'previa' | 'confirmar' | 'desfazer'; status: number; codigo: string; fieldErrors?: { field: string; message: string }[] } | null;
  /** Os ids de acordo recebidos pelo desfazer. */
  acordosDesfeitos: string[];
}

const SEM_ABERTAS = { quantidade: 0, valorCentavos: 0 };
export const RESUMO_DA_SAIDA_VAZIO: ResumoDaSaidaDoAluno = { aCancelar: SEM_ABERTAS, emAberto: SEM_ABERTAS, minimoAte: null, mesesQueFaltam: 0 };

/** Os lembretes como a API devolve numa consultoria que nunca os configurou. */
export const LEMBRETES_PADRAO: Lembretes = { ligado: false, diasAntes: 3, noDia: true, diasDepois: 3, versao: null, emailDisponivel: true };

/** As formas como a API devolve numa consultoria que nunca as gravou: InfinitePay e Manual ligados, sem Pix. */
export const FORMAS_PADRAO: FormasDeRecebimento = { infinitePay: true, linkProprio: false, pix: false, manual: true, pixConfig: null, versao: null };

/** Chave Pix fictícia (e-mail de exemplo) e a máscara que a API devolveria para ela. */
export const CHAVE_PIX_FALSA = 'treinador@exemplo.invalid';
export const CHAVE_PIX_FALSA_MASCARADA = 't***@exemplo.invalid';

/** Formas já gravadas com o Pix ligado (chave de e-mail fictícia), como a API devolve: só a máscara da chave. */
export const FORMAS_COM_PIX: FormasDeRecebimento = {
  infinitePay: true, linkProprio: true, pix: true, manual: true, versao: 2,
  pixConfig: { tipoChave: 'EMAIL', chaveConfigurada: true, chaveMascarada: CHAVE_PIX_FALSA_MASCARADA, nomeRecebedor: 'Treino Exemplo', cidade: 'Cascavel' },
};

/** O "código Pix" que a rota do aluno devolve: só o formato, sem chave de verdade (nenhum banco o aceitaria). */
export const CODIGO_PIX_FALSO = '00020126450014br.gov.bcb.pix0123chave-ficticia-do-teste5204000053039865406150.005802BR5914Treino Exemplo6008Cascavel62290525abcdef0123456789abcdef0126304ABCD';

/** A máscara da chave como a API (`ChavePix.mascarar`): nunca a chave inteira. */
function mascararChave(tipo: TipoDeChavePix, chave: string): string {
  const fim = (n: number) => chave.slice(-n);
  if (tipo === 'CPF') return `***.***.***-${fim(2)}`;
  if (tipo === 'CNPJ') return `**.***.***/****-${fim(2)}`;
  if (tipo === 'TELEFONE') return `+55 ** *****-${fim(4)}`;
  if (tipo === 'ALEATORIA') return `****-${fim(4)}`;
  const arroba = chave.indexOf('@');
  return arroba < 1 ? '***' : `${chave[0]}***${chave.slice(arroba)}`;
}

/** A chave canônica vale para o tipo? (O app já confere; aqui é a segunda barreira, como o servidor.) */
function chaveValida(tipo: string, chave: string): boolean {
  switch (tipo) {
    case 'CPF': return /^\d{11}$/.test(chave);
    case 'CNPJ': return /^[0-9A-Z]{12}\d{2}$/.test(chave);
    case 'EMAIL': return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(chave) && chave.length <= 77;
    case 'TELEFONE': return /^\+55\d{10,11}$/.test(chave);
    case 'ALEATORIA': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chave);
    default: return false;
  }
}

const TIPOS_DE_CHAVE: readonly string[] = ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'];

/** Como o `LinksExternos` do servidor: https, com host, sem usuário no endereço e na porta 443. */
function linkAceito(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && (u.port === '' || u.port === '443');
  } catch {
    return false;
  }
}

const linkRecusado = (route: Route) => json(route, {
  status: 422, message: 'Confira os dados do plano.', codigo: 'PLANO_INVALIDO',
  fieldErrors: [{ field: 'linkDePagamento', message: 'Link não aceito. Use um link https completo.' }],
}, 422);

/**
 * As formas que se aplicam ao aluno, como o servidor (`FormasDePagamentoDoAluno.decidir`): InfinitePay com a forma ligada e o
 * recebimento online pronto; link próprio com a forma ligada e o plano com link; Pix ligado e configurado com alguma aberta.
 */
function formasDoAluno(estado: EstadoFinanceiro, planoTemLink: boolean): FormaDeRecebimento[] {
  const f = estado.formas;
  const algumaAberta = estado.cobrancas.some((c) => c.situacao === 'ABERTA');
  return [
    ...(f.infinitePay && estado.pagamentoOnline ? ['INFINITEPAY' as const] : []),
    ...(f.linkProprio && planoTemLink ? ['LINK_PROPRIO' as const] : []),
    ...(f.pix && f.pixConfig && algumaAberta ? ['PIX' as const] : []),
    'MANUAL' as const,
  ];
}

export function estadoFinanceiro(parcial: Partial<EstadoFinanceiro> = {}): EstadoFinanceiro {
  return {
    planos: [], contratacoes: [], cobrancas: [], lancamentos: [], inadimplentes: [], painel: PAINEL_COM_DADOS,
    recebimento: { ...RECEBIMENTO_NAO_CONFIGURADO }, chaveGuardada: null, conferencias: [], pagamentoOnline: false, retornos: [],
    lembretes: { ...LEMBRETES_PADRAO }, lembretesDasCobrancas: {}, alunoRecebeLembretes: true, falhaAoDefinirLembretesDoAluno: null,
    pedidosDeLembretesDoAluno: [], renovacoes: null, renovacoesMeus: null, recusasDoLote: {}, lotesRecebidos: [], previas: {}, previaQueMuda: null,
    encerramentos: [], resumoDaSaida: RESUMO_DA_SAIDA_VAZIO, alunos: [], avulsasRecebidas: [], avulsasGeradas: {}, formas: { ...FORMAS_PADRAO }, chavePixGuardada: null,
    formasRecebidas: [], recusaDasFormas: null, pixPedidos: [],
    previaDeGeracao: { quantidade: 0, totalCentavos: 0, primeiraCompetencia: null, ultimaCompetencia: null }, falhasDaPrevia: 0, atrasoDaPreviaMs: 0,
    previasRecebidas: [], apagarPixRecebidos: [], previasDaRenegociacao: [], renegociacoesRecebidas: [], renegociacoesFeitas: {},
    recusaDaRenegociacao: null, acordosDesfeitos: [], ...parcial,
  };
}

function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

let sequencia = 0;
function idFalso(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}0000000-0000-4000-8000-${String(sequencia).padStart(12, '0')}`;
}

/** O relógio fixo dos testes (`fixarHoje`) é 19/10/2026 em São Paulo. */
const HOJE = '2026-10-19';

/**
 * A prévia de uma contratação sem tempo mínimo, como a API: as abertas vencidas e as a vencer ficam (nenhuma opção cancela),
 * "Meses que faltam" e "Mês vigente" indisponíveis, "Outro valor" só em contratação recorrente.
 */
function previaSemMinimo(estado: EstadoFinanceiro, contratacao: ContratacaoResponse): PreviaDoEncerramento {
  const abertas = estado.cobrancas.filter((c) => c.contratacaoId === contratacao.id && c.situacao === 'ABERTA');
  const grupo = (lista: CobrancaResponse[]) => ({ quantidade: lista.length, valorCentavos: lista.reduce((s, c) => s + c.valorCentavos, 0) });
  const recorrente = contratacao.periodicidade !== 'PARCELA_UNICA';
  return {
    contratacaoId: contratacao.id, periodicidade: contratacao.periodicidade, situacao: contratacao.situacao, minimoAte: null, mesesQueFaltam: 0,
    regraDeSaida: null, vencidas: grupo(abertas.filter((c) => c.vencida)), aVencerNoMinimo: SEM_ABERTAS, aVencerQueFicam: grupo(abertas.filter((c) => !c.vencida)),
    cobrancasACancelar: [], comLinkVivo: 0, mesesNaoGerados: 0, valorDosNaoGeradosCentavos: 0,
    opcoes: [
      { opcao: 'FALTAM', disponivel: false, valorCentavos: null, motivo: 'A contratação não tem tempo mínimo.' },
      { opcao: 'VIGENTE', disponivel: false, valorCentavos: null, motivo: 'A contratação não tem tempo mínimo.' },
      { opcao: 'OUTRO', disponivel: recorrente, valorCentavos: null, motivo: recorrente ? null : 'Só em contratação recorrente.' },
      { opcao: 'NAO_COBRAR', disponivel: true, valorCentavos: null, motivo: null },
    ],
  };
}

/** `AAAA-MM-DD` + `meses`, com o dia preso ao último do mês (31/01 + 1 = 28/02), sempre contado do primeiro vencimento. */
function somarMesesNoFalso(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const indice = mes - 1 + meses;
  const a = ano + Math.floor(indice / 12);
  const m = (indice % 12) + 1;
  return `${a}-${String(m).padStart(2, '0')}-${String(Math.min(dia, ultimoDia(a, m))).padStart(2, '0')}`;
}

/** Diferença em dias entre duas datas `AAAA-MM-DD` (dias de atraso das cobranças criadas no falso). */
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/**
 * Os totais do `GET /financeiro/cobrancas` sobre o filtro inteiro, como o contrato: cancelada e estornada fora; vencido =
 * aberta com vencimento antes de hoje; em aberto inclui a vencida. CONTESTADA entra só no total (como a API: "pago" é
 * só PAGA, a mesma regra do recebido do painel), então total ≠ pago + em aberto.
 */
function totaisDoFalso(itens: readonly CobrancaResponse[]) {
  const validas = itens.filter((c) => c.situacao !== 'CANCELADA' && c.situacao !== 'ESTORNADA' && c.situacao !== 'RENEGOCIADA');
  const soma = (lista: readonly CobrancaResponse[]) => lista.reduce((s, c) => s + c.valorCentavos, 0);
  const abertas = validas.filter((c) => c.situacao === 'ABERTA');
  return {
    totalCentavos: soma(validas),
    pagoCentavos: soma(validas.filter((c) => c.situacao === 'PAGA')),
    emAbertoCentavos: soma(abertas),
    vencidoCentavos: soma(abertas.filter((c) => c.vencimento < HOJE)),
  };
}

const avulsaInvalida = (route: Route, fieldErrors: { field: string; message: string }[]) =>
  json(route, { status: 422, message: 'Confira os dados da cobrança avulsa.', codigo: 'COBRANCA_AVULSA_INVALIDA', fieldErrors }, 422);

/** Os `cobrancaIds` dos lotes de link e de exportação: 1 a 100, sem repetir (senão 400, como a API). */
const idsDoLoteValidos = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length > 0 && ids.length <= 100 && new Set(ids).size === ids.length;

const conflito = (route: Route) => json(route, erroApi(409, 'Alguém alterou este registro.', 'CONFLITO_EDICAO').corpo, 409);

/** Contestar, estornar e manter paga: muda a situação se a atual permite, como a API (motivo e versão no corpo). */
function marcarSituacao(estado: EstadoFinanceiro, p: PedidoFalso, route: Route, de: CobrancaResponse['situacao'][],
                        para: CobrancaResponse['situacao'], codigo: string) {
  const id = p.caminho.split('/')[2];
  const c = p.corpo as { motivo: string; versao: number };
  const cobranca = estado.cobrancas.find((x) => x.id === id);
  if (!cobranca) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
  if (cobranca.situacao === para) return json(route, cobranca);
  if (!de.includes(cobranca.situacao)) return json(route, erroApi(409, 'Não vale nesta situação.', codigo).corpo, 409);
  if (cobranca.versao !== c.versao) return conflito(route);
  Object.assign(cobranca, { situacao: para, motivo: c.motivo, versao: cobranca.versao + 1 });
  return json(route, cobranca);
}

type PlanoDoCorpo = {
  nome: string; valorCentavos: number; periodicidade: PlanoResponse['periodicidade']; tempoMinimoMeses?: number | null; regraDeSaida?: string | null;
  linkDePagamento?: string | null; incluiTreino?: boolean; incluiDieta?: boolean; kiwifyAssinatura?: boolean; kiwifyProdutoId?: string | null;
};
/**
 * Kiwify (D17, `financeiroKiwify.ts`): só no mensal (422 em `kiwifyAssinatura`), ligado com produto e o produto em um plano só
 * entre os não arquivados (422 em `kiwifyProdutoId`). `outros` = os planos da consultoria menos o que está sendo salvo.
 */
function recusaDaKiwify(c: PlanoDoCorpo, route: Route, outros: readonly PlanoResponse[]) {
  const repetido = !!c.kiwifyAssinatura && outros.some((o) => !o.arquivado && o.kiwifyAssinatura && o.kiwifyProdutoId === c.kiwifyProdutoId?.trim());
  const campo = c.kiwifyAssinatura && c.periodicidade !== 'MENSAL' ? { field: 'kiwifyAssinatura', message: 'A assinatura pela Kiwify só vale em plano mensal.' }
    : c.kiwifyAssinatura && !c.kiwifyProdutoId?.trim() ? { field: 'kiwifyProdutoId', message: 'Informe o produto da Kiwify.' }
      : repetido ? { field: 'kiwifyProdutoId', message: 'Outro plano já usa este produto da Kiwify.' } : null;
  return campo ? json(route, { status: 422, message: 'Confira os dados do plano.', codigo: 'PLANO_INVALIDO', fieldErrors: [campo] }, 422) : null;
}
const kiwifyDoCorpo = (c: PlanoDoCorpo) => ({ kiwifyAssinatura: c.kiwifyAssinatura === true, kiwifyProdutoId: c.kiwifyAssinatura ? (c.kiwifyProdutoId ?? null) : null });
/** Como a API (D13, V091): ausente vale `true`; os dois `false` = 422 `PLANO_INVALIDO` no campo `incluiTreino`. */
const semNadaIncluido = (c: PlanoDoCorpo) => c.incluiTreino === false && c.incluiDieta === false;
const nadaIncluido = (route: Route) => json(route, {
  status: 422, message: 'Confira os dados do plano.', codigo: 'PLANO_INVALIDO',
  fieldErrors: [{ field: 'incluiTreino', message: 'Marque pelo menos um: treino ou dieta.' }],
}, 422);
const minimoForaDoMensal = (c: PlanoDoCorpo) => c.periodicidade !== 'MENSAL' && (c.tempoMinimoMeses != null || c.regraDeSaida != null);
const minimoSoNoMensal = (route: Route) => json(route, {
  status: 422, message: 'Confira os dados do plano.', codigo: 'PLANO_INVALIDO',
  fieldErrors: [{ field: 'tempoMinimoMeses', message: 'O tempo mínimo só vale em plano mensal.' }],
}, 422);

type ErroDoFalso = { status: number; codigo: string; mensagem: string; fieldErrors?: { field: string; message: string }[] };

/**
 * O Renegociar (D14) como o servidor: confere o corpo (422 `RENEGOCIACAO_INVALIDA`), as originais (404, 409 não aberta, tipo,
 * versão, alunos diferentes) e calcula total = soma + acréscimo − desconto, em parcelas iguais com a sobra na última e o
 * vencimento contado do primeiro (dia preso ao fim do mês). Só o falso calcula: ele faz o papel do servidor.
 */
function contaDaRenegociacao(estado: EstadoFinanceiro, c: PreviaDaRenegociacaoRequest, comMotivo?: string):
  { erro: ErroDoFalso } | { originais: CobrancaResponse[]; previa: PreviaDaRenegociacao } {
  const campos: { field: string; message: string }[] = [];
  const ajusteValido = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1_000_000_000;
  if (!Array.isArray(c.itens) || c.itens.length < 1 || c.itens.length > 100) campos.push({ field: 'itens', message: 'Escolha de 1 a 100 cobranças.' });
  else if (new Set(c.itens.map((i) => i.cobrancaId)).size !== c.itens.length) campos.push({ field: 'itens', message: 'Há cobrança repetida.' });
  if (!ajusteValido(c.acrescimoCentavos)) campos.push({ field: 'acrescimoCentavos', message: 'Acréscimo fora da faixa.' });
  if (!ajusteValido(c.descontoCentavos)) campos.push({ field: 'descontoCentavos', message: 'Desconto fora da faixa.' });
  if (!Number.isInteger(c.parcelas) || c.parcelas < 1 || c.parcelas > 12) campos.push({ field: 'parcelas', message: 'As parcelas vão de 1 a 12.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.primeiroVencimento ?? '')) campos.push({ field: 'primeiroVencimento', message: 'Data inválida.' });
  if (comMotivo !== undefined && (!comMotivo.trim() || comMotivo.trim().length > 300)) campos.push({ field: 'motivo', message: 'Informe o motivo, até 300 caracteres.' });
  const invalida = (fieldErrors: { field: string; message: string }[]) => ({ erro: { status: 422, codigo: 'RENEGOCIACAO_INVALIDA', mensagem: 'Confira os dados da renegociação.', fieldErrors } });
  if (campos.length) return invalida(campos);
  const originais: CobrancaResponse[] = [];
  for (const item of c.itens) {
    const cobranca = estado.cobrancas.find((x) => x.id === item.cobrancaId);
    if (!cobranca) return { erro: { status: 404, codigo: 'COBRANCA_NAO_ENCONTRADA', mensagem: 'Cobrança não encontrada.' } };
    if (cobranca.situacao !== 'ABERTA') return { erro: { status: 409, codigo: 'COBRANCA_NAO_ABERTA', mensagem: 'A cobrança não está em aberto.' } };
    if (cobranca.tipo !== 'MENSALIDADE' && cobranca.tipo !== 'AVULSA') return { erro: { status: 409, codigo: 'COBRANCA_NAO_RENEGOCIAVEL', mensagem: 'Esta cobrança não se renegocia.' } };
    // D3 (18/11): qualquer automática no lote barra o pedido todo, na prévia e no confirmar, com esta mensagem fixa.
    if (cobranca.cobrancaAutomatica === 'KIWIFY') {
      return { erro: { status: 409, codigo: 'RENEGOCIACAO_COBRANCA_AUTOMATICA', mensagem: 'Esta cobrança é cobrada automaticamente pela Kiwify e não pode ser renegociada.' } };
    }
    if (cobranca.versao !== item.versao) return { erro: { status: 409, codigo: 'CONFLITO_EDICAO', mensagem: 'Alguém alterou este registro.' } };
    originais.push(cobranca);
  }
  if (new Set(originais.map((o) => o.alunoId)).size > 1) return { erro: { status: 409, codigo: 'COBRANCAS_DE_ALUNOS_DIFERENTES', mensagem: 'Alunos diferentes.' } };
  const soma = originais.reduce((t, o) => t + o.valorCentavos, 0);
  const total = soma + c.acrescimoCentavos - c.descontoCentavos;
  if (total < c.parcelas) return invalida([{ field: 'descontoCentavos', message: 'O desconto não pode zerar o total.' }]);
  const base = Math.floor(total / c.parcelas);
  const parcelas = Array.from({ length: c.parcelas }, (_, i) => ({
    numero: i + 1, vencimento: somarMesesNoFalso(c.primeiroVencimento, i),
    valorCentavos: i === c.parcelas - 1 ? total - base * (c.parcelas - 1) : base,
    descricao: c.parcelas > 1 ? `Renegociação (Parcela ${i + 1}/${c.parcelas})` : 'Renegociação',
  }));
  return {
    originais,
    previa: {
      alunoId: originais[0].alunoId, quantidadeDeOriginais: originais.length, somaDosOriginaisCentavos: soma, acrescimoCentavos: c.acrescimoCentavos,
      descontoCentavos: c.descontoCentavos, totalCentavos: total, parcelas,
    },
  };
}

const respostaDeErro = (route: Route, e: ErroDoFalso) => json(route, erroApi(e.status, e.mensagem, e.codigo, e.fieldErrors ?? []).corpo, e.status);

/** A recusa forçada do teste para a rota (uma vez). */
function recusaForcada(estado: EstadoFinanceiro, rota: 'previa' | 'confirmar' | 'desfazer', route: Route) {
  const r = estado.recusaDaRenegociacao;
  if (!r || r.rota !== rota) return null;
  estado.recusaDaRenegociacao = null;
  return respostaDeErro(route, { ...r, mensagem: 'Recusado pelo servidor.' });
}

/** Rotas do financeiro para somar ao mapa de `simularApi`. */
export function rotasDoFinanceiro(estado: EstadoFinanceiro): RespostasApi {
  const marcar = (p: PedidoFalso, route: Route, de: CobrancaResponse['situacao'][], para: CobrancaResponse['situacao'], codigo: string) =>
    marcarSituacao(estado, p, route, de, para, codigo);
  return {
    'GET /financeiro/planos': (p, route) =>
      json(route, estado.planos.filter((x) => p.busca.get('arquivados') === 'true' || !x.arquivado)),
    'POST /financeiro/planos': (p, route) => {
      const c = p.corpo as PlanoDoCorpo;
      if (minimoForaDoMensal(c)) return minimoSoNoMensal(route);
      if (c.linkDePagamento && !linkAceito(c.linkDePagamento)) return linkRecusado(route);
      if (semNadaIncluido(c)) return nadaIncluido(route);
      const recusaKiwify = recusaDaKiwify(c, route, estado.planos);
      if (recusaKiwify) return recusaKiwify;
      const plano: PlanoResponse = {
        id: idFalso('b'), nome: c.nome, valorCentavos: c.valorCentavos, periodicidade: c.periodicidade,
        arquivado: false, criadoEm: '2026-10-19T12:00:00Z', versao: 0, tempoMinimoMeses: c.tempoMinimoMeses ?? null, regraDeSaida: c.regraDeSaida ?? null,
        linkDePagamento: c.linkDePagamento ?? null, incluiTreino: c.incluiTreino !== false, incluiDieta: c.incluiDieta !== false, ...kiwifyDoCorpo(c),
      };
      estado.planos.push(plano);
      return json(route, plano, 201);
    },
    // O `PUT` substitui inteiro, como a API: tempo mínimo e regra de saída só no plano mensal (422 no campo).
    'PUT /financeiro/planos/{id}': (p, route) => {
      const id = p.caminho.split('/')[3];
      const c = p.corpo as PlanoDoCorpo & { versao: number };
      const plano = estado.planos.find((x) => x.id === id);
      if (!plano) return json(route, erroApi(404, 'Plano comercial não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
      if (plano.versao !== c.versao) return conflito(route);
      if (minimoForaDoMensal(c)) return minimoSoNoMensal(route);
      if (c.linkDePagamento && !linkAceito(c.linkDePagamento)) return linkRecusado(route);
      if (semNadaIncluido(c)) return nadaIncluido(route);
      const recusaKiwify = recusaDaKiwify(c, route, estado.planos.filter((x) => x.id !== id));
      if (recusaKiwify) return recusaKiwify;
      // Substitui inteiro, como a API: o link ausente ou nulo APAGA o que havia (os campos da Kiwify, ausentes, ficam: chave desligada).
      Object.assign(plano, {
        nome: c.nome, valorCentavos: c.valorCentavos, periodicidade: c.periodicidade, tempoMinimoMeses: c.tempoMinimoMeses ?? null,
        regraDeSaida: c.regraDeSaida ?? null, linkDePagamento: c.linkDePagamento ?? null, incluiTreino: c.incluiTreino !== false,
        incluiDieta: c.incluiDieta !== false, versao: plano.versao + 1, ...('kiwifyAssinatura' in c ? kiwifyDoCorpo(c) : {}),
      });
      return json(route, plano);
    },
    'PUT /contratacoes/{id}': (p, route) => {
      const id = p.caminho.split('/')[2];
      const c = p.corpo as { valorCentavos: number; motivoValor: string | null; diaVencimento: number; minimoAte: string | null; versao: number };
      const contratacao = estado.contratacoes.find((x) => x.id === id);
      if (!contratacao) return json(route, erroApi(404, 'Contratação não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (contratacao.versao !== c.versao) return conflito(route);
      Object.assign(contratacao, {
        valorCentavos: c.valorCentavos, motivoValor: c.motivoValor, diaVencimento: c.diaVencimento, minimoAte: c.minimoAte, versao: contratacao.versao + 1,
      });
      return json(route, contratacao);
    },
    'GET /contratacoes/{id}/previa-de-encerramento': (p, route) => {
      const id = p.caminho.split('/')[2];
      const contratacao = estado.contratacoes.find((x) => x.id === id);
      if (!contratacao) return json(route, erroApi(404, 'Contratação não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (contratacao.situacao === 'ENCERRADA') return json(route, erroApi(409, 'A contratação já foi encerrada.', 'CONTRATACAO_ENCERRADA').corpo, 409);
      return json(route, estado.previas[id] ?? previaSemMinimo(estado, contratacao));
    },
    // Encerrar com a saída opcional: a conta é a da prévia (o valor de FALTAM e VIGENTE é conferido), cancela as a vencer do
    // FALTAM e cria a cobrança `tipo=SAIDA`. Sem `saida`, encerra como antes (as abertas ficam).
    'POST /contratacoes/{id}/encerrar': (p, route) => {
      const id = p.caminho.split('/')[2];
      const c = p.corpo as EncerrarContratacaoRequest;
      estado.encerramentos.push(c);
      const contratacao = estado.contratacoes.find((x) => x.id === id);
      if (!contratacao) return json(route, erroApi(404, 'Contratação não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (contratacao.versao !== c.versao) return conflito(route);
      const previa = estado.previas[id] ?? previaSemMinimo(estado, contratacao);
      const saida = c.saida;
      const da = saida ? previa.opcoes.find((o) => o.opcao === saida.opcao) : undefined;
      const calculada = !!saida && (saida.opcao === 'FALTAM' || saida.opcao === 'VIGENTE');
      if (saida && (estado.previaQueMuda !== null || (calculada && da?.valorCentavos !== saida.valorCentavos))) {
        if (estado.previaQueMuda) estado.previas[id] = estado.previaQueMuda;
        estado.previaQueMuda = null;
        return json(route, erroApi(409, 'A conta da saída mudou.', 'VALOR_DA_SAIDA_MUDOU').corpo, 409);
      }
      Object.assign(contratacao, { situacao: 'ENCERRADA', encerradaEm: HOJE, versao: contratacao.versao + 1 });
      if (saida?.opcao === 'FALTAM') {
        for (const cobranca of estado.cobrancas) {
          if (saida.cobrancasACancelar?.includes(cobranca.id)) Object.assign(cobranca, { situacao: 'CANCELADA', motivo: 'Cobrança de saída', versao: cobranca.versao + 1 });
        }
      }
      if (saida && saida.opcao !== 'NAO_COBRAR' && saida.valorCentavos) {
        estado.cobrancas.push({
          ...COBRANCA_ATRASADA, id: idFalso('c'), contratacaoId: contratacao.id, alunoId: contratacao.alunoId, alunoNome: ALUNO.nome,
          planoNome: contratacao.planoNome, competencia: HOJE, vencimento: saida.vencimento ?? HOJE, valorCentavos: saida.valorCentavos,
          vencida: false, diasDeAtraso: null, criadoEm: '2026-10-19T12:00:00Z', tipo: 'SAIDA',
        });
      }
      return json(route, contratacao);
    },
    'GET /alunos/{id}/resumo-da-saida': (_p, route) => json(route, estado.resumoDaSaida),
    'GET /financeiro/cobrancas': (p, route) => {
      // Várias situações em OU (VENCIDA = aberta já vencida) e a busca pelo nome do aluno, como a API.
      const situacoes = p.busca.getAll('situacao');
      const busca = (p.busca.get('busca') ?? '').toLowerCase();
      // Vencimento (`de`/`ate`), emissão (dia de `criadoEm`) e pagamento (`pagoEm`), dias inclusivos como na API.
      const entre = (dia: string | null | undefined, de: string | null, ate: string | null) =>
        (!de && !ate) || (!!dia && (!de || dia >= de) && (!ate || dia <= ate));
      const q = (k: string) => p.busca.get(k);
      const itens = estado.cobrancas.filter((c) => (!situacoes.length || situacoes.some((s) => (s === 'VENCIDA' ? c.situacao === 'ABERTA' && c.vencida : c.situacao === s)))
        && (!busca || (c.alunoNome ?? '').toLowerCase().includes(busca))
        && (!q('alunoId') || c.alunoId === q('alunoId'))
        && entre(c.vencimento, q('de'), q('ate'))
        && entre(c.criadoEm?.slice(0, 10), q('emissaoDe'), q('emissaoAte'))
        && entre(c.pagoEm, q('pagoDe'), q('pagoAte')));
      return json(route, { itens, total: itens.length, pagina: 0, totais: totaisDoFalso(itens) });
    },
    // Como a API: a situação (padrão ATIVO), busca no nome e páginas de `tamanho` (padrão 30, de 1 a 100).
    'GET /alunos': (p, route) => {
      const busca = (p.busca.get('busca') ?? '').toLowerCase();
      const pagina = Number(p.busca.get('pagina') ?? 0);
      const tamanho = Math.min(100, Math.max(1, Number(p.busca.get('tamanho') ?? 30)));
      const situacao = p.busca.get('situacao') ?? 'ATIVO';
      const daSituacao = (a: AlunoResumo) => situacao === 'TODOS' || (situacao === 'ATIVO') === a.ativo;
      const lista = estado.alunos.filter((a) => daSituacao(a) && (!busca || a.nome.toLowerCase().includes(busca)));
      return json(route, { itens: lista.slice(pagina * tamanho, pagina * tamanho + tamanho), total: lista.length });
    },
    // Avulsa, tudo ou nada: 422 por campo, 404 aluno que não existe, 409 inativo; a parcela k vence no primeiro + (k-1) meses.
    // Idempotente pelo `pedidoId` (D11): o pedido já gerado responde 200 com a mesma resposta e nada novo; só o sucesso o guarda.
    'POST /financeiro/cobrancas-avulsas': (p, route) => {
      const c = p.corpo as CobrancaAvulsaRequest;
      estado.avulsasRecebidas.push(c);
      const jaGerado = estado.avulsasGeradas[c.pedidoId];
      if (jaGerado) return json(route, jaGerado, 200);
      const erros: { field: string; message: string }[] = [];
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.pedidoId ?? '')) erros.push({ field: 'pedidoId', message: 'Pedido inválido.' });
      if (!Array.isArray(c.alunoIds) || c.alunoIds.length < 1 || c.alunoIds.length > 100) erros.push({ field: 'alunoIds', message: 'Escolha de 1 a 100 alunos.' });
      else if (new Set(c.alunoIds).size !== c.alunoIds.length) erros.push({ field: 'alunoIds', message: 'Há aluno repetido.' });
      const descricao = (c.descricao ?? '').trim();
      if (!descricao || descricao.length > 120) erros.push({ field: 'descricao', message: 'A descrição vai de 1 a 120 caracteres.' });
      if (!Number.isInteger(c.valorCentavos) || c.valorCentavos < 1 || c.valorCentavos > 1_000_000_000) erros.push({ field: 'valorCentavos', message: 'Valor fora da faixa.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.primeiroVencimento ?? '')) erros.push({ field: 'primeiroVencimento', message: 'Data inválida.' });
      if (!Number.isInteger(c.parcelas) || c.parcelas < 1 || c.parcelas > 12) erros.push({ field: 'parcelas', message: 'As parcelas vão de 1 a 12.' });
      if (erros.length) return avulsaInvalida(route, erros);
      const alunos = c.alunoIds.map((id) => estado.alunos.find((a) => a.id === id));
      if (alunos.some((a) => !a)) return json(route, erroApi(404, 'Aluno não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
      if (alunos.some((a) => !a?.ativo)) return json(route, erroApi(409, 'O aluno está inativo.', 'ALUNO_INATIVO').corpo, 409);
      for (const aluno of alunos) {
        if (!aluno) continue;
        for (let k = 1; k <= c.parcelas; k += 1) {
          const vencimento = somarMesesNoFalso(c.primeiroVencimento, k - 1);
          const vencida = vencimento < HOJE;
          estado.cobrancas.push({
            ...COBRANCA_ATRASADA, id: idFalso('c'), contratacaoId: null, alunoId: aluno.id, alunoNome: aluno.nome, planoNome: null,
            competencia: null, vencimento, valorCentavos: c.valorCentavos, vencida, diasDeAtraso: vencida ? diasEntre(vencimento, HOJE) : null,
            criadoEm: '2026-10-19T12:00:00Z', tipo: 'AVULSA', descricao: c.parcelas > 1 ? `${descricao} (Parcela ${k}/${c.parcelas})` : descricao,
          });
        }
      }
      const resposta = { alunos: alunos.length, cobrancas: alunos.length * c.parcelas };
      estado.avulsasGeradas[c.pedidoId] = resposta;
      return json(route, resposta, 201);
    },
    // Lotes de cancelar e de link: cada item em separado, na ordem do pedido; `recusasDoLote` força a recusa de um item.
    'POST /cobrancas/cancelar-em-lote': (p, route) => {
      const c = p.corpo as { itens: { cobrancaId: string; versao: number }[]; motivo?: string | null };
      if (!c.itens?.length || c.itens.length > 100 || new Set(c.itens.map((i) => i.cobrancaId)).size !== c.itens.length) {
        return json(route, erroApi(400, 'Lote inválido.', 'LOTE_INVALIDO').corpo, 400);
      }
      const resultados = c.itens.map(({ cobrancaId, versao }) => {
        const cobranca = estado.cobrancas.find((x) => x.id === cobrancaId);
        const recusa = estado.recusasDoLote[cobrancaId];
        if (recusa) return { cobrancaId, ok: false, codigo: recusa };
        if (!cobranca) return { cobrancaId, ok: false, codigo: 'COBRANCA_NAO_ENCONTRADA' };
        if (cobranca.situacao !== 'ABERTA') return { cobrancaId, ok: false, codigo: 'COBRANCA_NAO_ABERTA' };
        if (cobranca.versao !== versao) return { cobrancaId, ok: false, codigo: 'CONFLITO_EDICAO' };
        Object.assign(cobranca, { situacao: 'CANCELADA', motivo: c.motivo ?? null, vencida: false, diasDeAtraso: null, versao: cobranca.versao + 1 });
        return { cobrancaId, ok: true, codigo: null };
      });
      return json(route, { resultados });
    },
    'POST /cobrancas/link-em-lote': (p, route) => {
      const ids = (p.corpo as { cobrancaIds?: unknown }).cobrancaIds;
      if (!idsDoLoteValidos(ids)) return json(route, erroApi(400, 'Lote inválido.', 'LOTE_INVALIDO').corpo, 400);
      const resultados = ids.map((cobrancaId) => {
        const cobranca = estado.cobrancas.find((x) => x.id === cobrancaId);
        const recusa = estado.recusasDoLote[cobrancaId];
        if (recusa) return { cobrancaId, ok: false, codigo: recusa, url: null };
        if (!cobranca) return { cobrancaId, ok: false, codigo: 'COBRANCA_NAO_ENCONTRADA', url: null };
        if (cobranca.situacao !== 'ABERTA') return { cobrancaId, ok: false, codigo: 'COBRANCA_NAO_ABERTA', url: null };
        if (cobranca.tipo === 'SAIDA') return { cobrancaId, ok: false, codigo: 'COBRANCA_SEM_LINK', url: null };
        if (cobranca.cobrancaAutomatica === 'KIWIFY') return { cobrancaId, ok: false, codigo: 'COBRANCA_AUTOMATICA', url: null };
        if (!estado.recebimento.configurado) return { cobrancaId, ok: false, codigo: 'RECEBIMENTO_ONLINE_NAO_CONFIGURADO', url: null };
        return { cobrancaId, ok: true, codigo: null, url: `${LINK_DE_PAGAMENTO}-${cobrancaId.slice(-4)}` };
      });
      return json(route, { resultados });
    },
    // O CSV das selecionadas, com as colunas da exportação por período (só dados fictícios).
    'POST /financeiro/exportacao/selecionadas': (p, route) => {
      const ids = (p.corpo as { cobrancaIds?: unknown }).cobrancaIds;
      if (!idsDoLoteValidos(ids)) return json(route, erroApi(400, 'Lote inválido.', 'LOTE_INVALIDO').corpo, 400);
      const linhas = estado.cobrancas.filter((c) => ids.includes(c.id))
        .map((c) => `COBRANCA;${c.vencimento};${c.descricao ?? c.planoNome ?? ''};${c.alunoNome ?? ''};${c.situacao};;;${c.tipo};;${(c.valorCentavos / 100).toFixed(2).replace('.', ',')};false`);
      const cabecalho = 'registro;data;descricao;aluno;situacao;forma;pago_em;tipo;categoria;valor;historico_financeiro_parcial';
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: [cabecalho, ...linhas].join('\n') });
    },
    'GET /financeiro/inadimplentes': (_p, route) => json(route, {
      itens: estado.inadimplentes,
      total: estado.inadimplentes.length,
      valorTotalCentavos: estado.inadimplentes.length ? estado.inadimplentes.reduce((s, i) => s + i.valorCentavos, 0) : 0,
      pagina: 0,
    }),
    'GET /financeiro/painel': (p, route) => json(route, { ...estado.painel, somenteMeus: p.busca.get('meus') === 'true' }),
    'GET /financeiro/visao-geral': (p, route) => {
      const dados = p.busca.get('meus') === 'true' ? estado.renovacoesMeus ?? estado.renovacoes : estado.renovacoes;
      return dados ? json(route, dados) : json(route, erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
    },
    'GET /financeiro/lancamentos': (_p, route) => json(route, { itens: estado.lancamentos, total: estado.lancamentos.length, pagina: 0 }),
    'GET /financeiro/lancamentos/categorias': (_p, route) =>
      json(route, [...new Set(estado.lancamentos.map((l) => l.categoria).filter((c): c is string => !!c))].sort()),
    'POST /financeiro/lancamentos': (p, route) => {
      const c = p.corpo as { data: string; descricao: string; valorCentavos: number; tipo: LancamentoResponse['tipo']; categoria?: string | null };
      const novo: LancamentoResponse = {
        id: idFalso('d'), data: c.data, descricao: c.descricao, valorCentavos: c.valorCentavos, tipo: c.tipo, categoria: c.categoria ?? null,
        criadoEm: '2026-10-19T12:00:00Z', versao: 0,
      };
      estado.lancamentos.push(novo);
      // O resultado do mês acompanha o lançamento, como o painel de verdade.
      const r = estado.painel.resultadoDoMes;
      const saidas = (r.saidasAvulsasCentavos ?? 0) + (c.tipo === 'SAIDA' ? c.valorCentavos : 0);
      const entradas = (r.entradasAvulsasCentavos ?? 0) + (c.tipo === 'ENTRADA' ? c.valorCentavos : 0);
      estado.painel = {
        ...estado.painel,
        resultadoDoMes: {
          ...r, saidasAvulsasCentavos: saidas, entradasAvulsasCentavos: entradas, resultadoCentavos: (r.recebidoCentavos ?? 0) + entradas - saidas,
        },
      };
      return json(route, novo, 201);
    },
    'GET /alunos/{id}/contratacoes': (_p, route) => json(route, estado.contratacoes),
    // Só leitura, como a API: o falso não conta mensalidade nenhuma, devolve a prévia que o teste montou.
    'POST /contratacoes/previa-de-geracao': async (p, route) => {
      estado.previasRecebidas.push(p.corpo);
      if (estado.atrasoDaPreviaMs > 0) await new Promise((r) => setTimeout(r, estado.atrasoDaPreviaMs));
      if (estado.falhasDaPrevia > 0) {
        estado.falhasDaPrevia -= 1;
        return json(route, erroApi(500, 'Erro inesperado.', 'ERRO_INTERNO').corpo, 500);
      }
      return json(route, estado.previaDeGeracao);
    },
    'POST /alunos/{id}/contratacoes': (p, route) => {
      const c = p.corpo as { planoComercialId: string; valorCentavos?: number | null; motivoValor?: string | null; inicio: string; diaVencimento: number; gerarMesesAnteriores?: boolean };
      const plano = estado.planos.find((x) => x.id === c.planoComercialId);
      if (!plano) return json(route, erroApi(404, 'Plano comercial não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
      if (estado.contratacoes.some((x) => x.situacao !== 'ENCERRADA')) {
        return json(route, erroApi(409, 'O aluno já tem um plano vigente.', 'CONTRATACAO_VIGENTE').corpo, 409);
      }
      const valorCentavos = c.valorCentavos ?? plano.valorCentavos;
      const contratacao: ContratacaoResponse = {
        id: idFalso('e'), alunoId: ALUNO_FINANCEIRO_ID, planoComercialId: plano.id, planoNome: plano.nome, periodicidade: plano.periodicidade,
        valorCentavos, motivoValor: c.motivoValor ?? null, inicio: c.inicio, diaVencimento: c.diaVencimento, situacao: 'ATIVA', encerradaEm: null,
        criadoEm: '2026-10-19T12:00:00Z', versao: 0, minimoAte: null,
      };
      estado.contratacoes.push(contratacao);
      // D10: sem gerar os meses anteriores, a primeira cobrança é a do mês corrente (o início fica gravado como veio).
      const competencia = !c.gerarMesesAnteriores && c.inicio.slice(0, 7) < HOJE.slice(0, 7) ? `${HOJE.slice(0, 7)}-01` : c.inicio;
      const [ano, mes] = competencia.split('-').map(Number);
      const dia = Math.min(c.diaVencimento, ultimoDia(ano, mes));
      const vencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const vencida = vencimento < HOJE;
      estado.cobrancas.push({
        id: idFalso('c'), contratacaoId: contratacao.id, alunoId: ALUNO_FINANCEIRO_ID, alunoNome: ALUNO.nome, planoNome: plano.nome,
        competencia, vencimento, valorCentavos, situacao: 'ABERTA', vencida, diasDeAtraso: vencida ? 1 : null, forma: null, provedor: null,
        pagoEm: null, baixaPor: null, baixaPorNome: null, observacao: null, motivo: null, versao: 0, tipo: 'MENSALIDADE', descricao: null,
      });
      return json(route, contratacao, 201);
    },
    'GET /alunos/{id}/cobrancas': (_p, route) => json(route, estado.cobrancas),
    'POST /cobrancas/{id}/baixa-manual': (p, route) => {
      const id = p.caminho.split('/')[2];
      const c = p.corpo as { data: string; forma: CobrancaResponse['forma']; observacao?: string | null; versao: number };
      const cobranca = estado.cobrancas.find((x) => x.id === id);
      if (!cobranca) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (cobranca.versao !== c.versao) return conflito(route);
      estado.inadimplentes = estado.inadimplentes.filter((i) => i.cobrancaId !== id);
      Object.assign(cobranca, {
        situacao: 'PAGA', forma: c.forma, provedor: 'MANUAL', pagoEm: c.data, baixaPorNome: TREINADOR.nome, observacao: c.observacao ?? null,
        vencida: false, diasDeAtraso: null, versao: cobranca.versao + 1,
      });
      return json(route, cobranca);
    },
    'POST /cobrancas/baixa-em-lote': (p, route) => {
      // Como a API: cada item em separado, na ordem do pedido; já paga é ok; recusa só pelo código, sem mensagem.
      const c = p.corpo as { itens: { cobrancaId: string; versao: number }[]; data: string; forma: CobrancaResponse['forma']; observacao?: string | null };
      estado.lotesRecebidos.push(c);
      if (!c.itens.length || c.itens.length > 100 || new Set(c.itens.map((i) => i.cobrancaId)).size !== c.itens.length) {
        return json(route, erroApi(400, 'Lote inválido.', 'LOTE_INVALIDO').corpo, 400);
      }
      const resultados = c.itens.map(({ cobrancaId, versao }) => {
        const cobranca = estado.cobrancas.find((x) => x.id === cobrancaId);
        const recusa = estado.recusasDoLote[cobrancaId];
        if (recusa) return { cobrancaId, ok: false, codigo: recusa };
        if (!cobranca) return { cobrancaId, ok: false, codigo: 'COBRANCA_NAO_ENCONTRADA' };
        if (cobranca.situacao === 'PAGA') return { cobrancaId, ok: true, codigo: null };
        if (cobranca.situacao !== 'ABERTA') return { cobrancaId, ok: false, codigo: 'COBRANCA_NAO_ABERTA' };
        if (cobranca.versao !== versao) return { cobrancaId, ok: false, codigo: 'CONFLITO_EDICAO' };
        estado.inadimplentes = estado.inadimplentes.filter((i) => i.cobrancaId !== cobrancaId);
        Object.assign(cobranca, {
          situacao: 'PAGA', forma: c.forma, provedor: 'MANUAL', pagoEm: c.data, baixaPorNome: TREINADOR.nome, observacao: c.observacao ?? null,
          vencida: false, diasDeAtraso: null, versao: cobranca.versao + 1,
        });
        return { cobrancaId, ok: true, codigo: null };
      });
      return json(route, { resultados });
    },
    'POST /cobrancas/renegociar/previa': (p, route) => {
      const c = p.corpo as PreviaDaRenegociacaoRequest;
      estado.previasDaRenegociacao.push(c);
      const forcada = recusaForcada(estado, 'previa', route);
      if (forcada) return forcada;
      const r = contaDaRenegociacao(estado, c);
      return 'erro' in r ? respostaDeErro(route, r.erro) : json(route, r.previa);
    },
    // Tudo ou nada; o mesmo `pedidoId` de novo devolve 200 com a mesma resposta, sem mexer em nada (como a D11).
    'POST /cobrancas/renegociar': (p, route) => {
      const c = p.corpo as RenegociarRequest;
      estado.renegociacoesRecebidas.push(c);
      const feita = estado.renegociacoesFeitas[c.pedidoId];
      if (feita) return json(route, feita, 200);
      const forcada = recusaForcada(estado, 'confirmar', route);
      if (forcada) return forcada;
      const r = contaDaRenegociacao(estado, c, c.motivo ?? '');
      if ('erro' in r) return respostaDeErro(route, r.erro);
      const acordoId = idFalso('f');
      for (const o of r.originais) Object.assign(o, { situacao: 'RENEGOCIADA', acordoId, motivo: c.motivo.trim(), vencida: false, diasDeAtraso: null, versao: o.versao + 1 });
      estado.inadimplentes = estado.inadimplentes.filter((i) => !r.originais.some((o) => o.id === i.cobrancaId));
      const modelo = r.originais[0];
      for (const parcela of r.previa.parcelas) {
        const vencida = parcela.vencimento < HOJE;
        estado.cobrancas.push({
          ...modelo, id: idFalso('c'), contratacaoId: null, planoNome: null, competencia: null, vencimento: parcela.vencimento,
          valorCentavos: parcela.valorCentavos, situacao: 'ABERTA', vencida, diasDeAtraso: vencida ? diasEntre(parcela.vencimento, HOJE) : null,
          forma: null, provedor: null, pagoEm: null, baixaPor: null, baixaPorNome: null, observacao: null, motivo: null, versao: 0,
          criadoEm: '2026-10-19T12:00:00Z', tipo: 'RENEGOCIACAO', descricao: parcela.descricao, acordoId,
        });
      }
      const resposta: RenegociacaoResponse = { acordoId, renegociadas: r.originais.length, parcelas: r.previa.parcelas.length, totalCentavos: r.previa.totalCentavos };
      estado.renegociacoesFeitas[c.pedidoId] = resposta;
      return json(route, resposta, 201);
    },
    // Desfazer: só sem parcela paga, contestada ou estornada; as originais voltam a abertas e as parcelas abertas são canceladas.
    'POST /cobrancas/acordos/{id}/desfazer': (p, route) => {
      const acordoId = p.caminho.split('/')[3];
      estado.acordosDesfeitos.push(acordoId);
      const forcada = recusaForcada(estado, 'desfazer', route);
      if (forcada) return forcada;
      const doAcordo = estado.cobrancas.filter((x) => x.acordoId === acordoId);
      if (!doAcordo.length) return json(route, erroApi(404, 'Acordo não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
      const parcelas = doAcordo.filter((x) => x.tipo === 'RENEGOCIACAO');
      if (parcelas.some((x) => x.situacao === 'PAGA' || x.situacao === 'CONTESTADA' || x.situacao === 'ESTORNADA')) {
        return json(route, erroApi(409, 'Alguma parcela do acordo já foi paga, contestada ou estornada.', 'ACORDO_NAO_DESFAZIVEL').corpo, 409);
      }
      const { motivo } = p.corpo as { motivo: string };
      const originais = doAcordo.filter((x) => x.situacao === 'RENEGOCIADA');
      for (const o of originais) {
        const vencida = o.vencimento < HOJE;
        Object.assign(o, { situacao: 'ABERTA', acordoId: null, motivo: null, vencida, diasDeAtraso: vencida ? diasEntre(o.vencimento, HOJE) : null, versao: o.versao + 1 });
      }
      for (const x of parcelas) Object.assign(x, { situacao: 'CANCELADA', motivo, vencida: false, diasDeAtraso: null, versao: x.versao + 1 });
      return json(route, { acordoId, reabertas: originais.length, canceladas: parcelas.length });
    },
    'POST /cobrancas/{id}/contestar': (p, route) => marcar(p, route, ['PAGA'], 'CONTESTADA', 'COBRANCA_NAO_PAGA'),
    'POST /cobrancas/{id}/estornar': (p, route) => marcar(p, route, ['PAGA', 'CONTESTADA'], 'ESTORNADA', 'COBRANCA_NAO_PAGA'),
    'POST /cobrancas/{id}/manter-paga': (p, route) => marcar(p, route, ['CONTESTADA'], 'PAGA', 'COBRANCA_NAO_CONTESTADA'),
    'GET /aluno/financeiro': (_p, route) => {
      const vigente = estado.contratacoes.find((x) => x.situacao !== 'ENCERRADA') ?? null;
      const doAluno = (c: CobrancaResponse): CobrancaDoAluno => ({
        id: c.id, competencia: c.competencia, vencimento: c.vencimento, valorCentavos: c.valorCentavos, situacao: c.situacao, vencida: c.vencida,
        forma: c.forma, pagoEm: c.pagoEm, tipo: c.tipo, descricao: c.descricao,
        // Kiwify (D18): a marca vem da cobrança, como a API calcula na leitura.
        ...(c.cobrancaAutomatica ? { cobrancaAutomatica: c.cobrancaAutomatica } : {}),
      });
      const linkDoPlano = vigente ? (estado.planos.find((x) => x.id === vigente.planoComercialId)?.linkDePagamento ?? null) : null;
      const corpo: FinanceiroDoAluno = {
        plano: vigente
          ? {
              contratacaoId: vigente.id, planoNome: vigente.planoNome, valorCentavos: vigente.valorCentavos, periodicidade: vigente.periodicidade,
              situacao: vigente.situacao, proximoVencimento: estado.cobrancas.find((c) => c.situacao === 'ABERTA')?.vencimento ?? null,
              linkDePagamento: linkDoPlano,
            }
          : null,
        abertas: estado.cobrancas.filter((c) => c.situacao === 'ABERTA').map(doAluno),
        historico: estado.cobrancas.filter((c) => c.situacao !== 'ABERTA').map(doAluno),
        pagamentoOnline: estado.pagamentoOnline,
        formasDePagamento: formasDoAluno(estado, !!linkDoPlano),
      };
      return json(route, corpo);
    },
    // O Pix da cobrança do aluno: 404 se não existe (ou é de outro aluno); 409 `PIX_INDISPONIVEL` se não está aberta ou o Pix não vale.
    'POST /aluno/financeiro/cobrancas/{id}/pix': (p, route) => {
      const id = p.caminho.split('/')[4];
      estado.pixPedidos.push(id);
      const cobranca = estado.cobrancas.find((x) => x.id === id);
      if (!cobranca) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (cobranca.situacao !== 'ABERTA' || !estado.formas.pix || !estado.formas.pixConfig) {
        return json(route, erroApi(409, 'O Pix não está disponível para esta cobrança.', 'PIX_INDISPONIVEL').corpo, 409);
      }
      return json(route, { codigo: CODIGO_PIX_FALSO });
    },
    'GET /financeiro/formas-de-recebimento': (_p, route) => json(route, estado.formas),
    // Mesmas regras do servidor: `versao` igual à gravada (nula na primeira vez), Manual sempre ligado, Pix ligado exige
    // `pixConfig` completo; a chave omitida mantém a gravada (só com o mesmo tipo); `pix: false` mantém o Pix gravado.
    'PUT /financeiro/formas-de-recebimento': (p, route) => {
      const c = p.corpo as FormasDeRecebimentoRequest;
      estado.formasRecebidas.push(c);
      if ((c.versao ?? null) !== estado.formas.versao) return conflito(route);
      const invalidas = (fieldErrors: { field: string; message: string }[]) =>
        json(route, { status: 422, message: 'Confira as formas de recebimento.', codigo: 'FORMAS_INVALIDAS', fieldErrors }, 422);
      if (estado.recusaDasFormas) {
        const campos = estado.recusaDasFormas;
        estado.recusaDasFormas = null;
        return invalidas(campos);
      }
      const erros: { field: string; message: string }[] = [];
      if (c.manual !== true) erros.push({ field: 'manual', message: 'O Manual fica sempre ligado.' });
      const px = c.pixConfig;
      const gravado = estado.formas.pixConfig;
      if (c.pix && !px) erros.push({ field: 'pixConfig', message: 'Informe os dados do Pix.' });
      if (px) {
        if (!TIPOS_DE_CHAVE.includes(px.tipoChave)) erros.push({ field: 'pixConfig.tipoChave', message: 'Escolha o tipo da chave.' });
        else if (px.chave !== undefined && !chaveValida(px.tipoChave, px.chave)) erros.push({ field: 'pixConfig.chave', message: 'A chave não vale para o tipo escolhido.' });
        else if (px.chave === undefined && (!estado.chavePixGuardada || gravado?.tipoChave !== px.tipoChave)) erros.push({ field: 'pixConfig.chave', message: 'Informe a chave Pix.' });
        const nome = (px.nomeRecebedor ?? '').trim();
        const cidade = (px.cidade ?? '').trim();
        if (!nome || nome.length > 25) erros.push({ field: 'pixConfig.nomeRecebedor', message: 'O nome do recebedor vai de 1 a 25 caracteres.' });
        if (!cidade || cidade.length > 15) erros.push({ field: 'pixConfig.cidade', message: 'A cidade vai de 1 a 15 caracteres.' });
      }
      if (erros.length) return invalidas(erros);
      if (px?.chave !== undefined) estado.chavePixGuardada = px.chave;
      const pixConfig = px && estado.chavePixGuardada
        ? { tipoChave: px.tipoChave, chaveConfigurada: true, chaveMascarada: mascararChave(px.tipoChave, estado.chavePixGuardada), nomeRecebedor: px.nomeRecebedor.trim(), cidade: px.cidade.trim() }
        : gravado;
      estado.formas = {
        infinitePay: c.infinitePay, linkProprio: c.linkProprio, pix: c.pix, manual: true, pixConfig,
        versao: estado.formas.versao === null ? 0 : estado.formas.versao + 1,
      };
      return json(route, estado.formas);
    },
    // D12: zera chave, nome e cidade e desliga o Pix; a resposta é o corpo do `GET`. Versão diferente da gravada = 409.
    'POST /financeiro/formas-de-recebimento/pix/apagar': (p, route) => {
      const { versao } = p.corpo as { versao: number };
      estado.apagarPixRecebidos.push(versao);
      if (versao !== estado.formas.versao) return conflito(route);
      estado.chavePixGuardada = null;
      estado.formas = { ...estado.formas, pix: false, pixConfig: null, versao: (estado.formas.versao ?? 0) + 1 };
      return json(route, estado.formas);
    },
    'GET /financeiro/recebimento-online': (_p, route) => json(route, estado.recebimento),

    // Mesmas regras do servidor: sem credencial a `versao` tem de vir nula; com ela, tem de ser a atual.
    'PUT /financeiro/recebimento-online': (p, route) => {
      const c = p.corpo as {
        infiniteTag: string; apiKey?: string; removerApiKey?: boolean; jurosDoParcelamento?: JurosDoParcelamento; versao?: number | null;
      };
      const atual = estado.recebimento;
      if (atual.configurado ? c.versao !== atual.versao : c.versao !== null && c.versao !== undefined) return conflito(route);
      const tag = c.infiniteTag.trim().replace(/^[$]/, '').trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,40}$/.test(tag)) {
        return json(route, {
          status: 422, message: 'Confira os dados do recebimento online.', codigo: 'RECEBIMENTO_ONLINE_INVALIDO',
          fieldErrors: [{ field: 'infiniteTag', message: 'Use a InfiniteTag sem o cifrão: de 3 a 40 letras, números, ponto, hífen ou sublinhado.' }],
        }, 422);
      }
      // Mesmas regras do servidor: omitido na criação = ALUNO, omitido na alteração = não muda; TREINADOR exige a chave (a que
      // fica depois deste PUT), senão 422 no campo `jurosDoParcelamento`.
      const temChave = c.apiKey ? true : c.removerApiKey ? false : atual.apiKeyConfigurada;
      const juros: JurosDoParcelamento = c.jurosDoParcelamento ?? (atual.configurado ? (atual.jurosDoParcelamento ?? 'ALUNO') : 'ALUNO');
      if (juros === 'TREINADOR' && !temChave) {
        return json(route, {
          status: 422, message: 'Confira os dados do recebimento online.', codigo: 'RECEBIMENTO_ONLINE_INVALIDO',
          fieldErrors: [{ field: 'jurosDoParcelamento', message: 'Para absorver os juros, configure a API Key.' }],
        }, 422);
      }
      if (c.apiKey) estado.chaveGuardada = c.apiKey.trim();
      else if (c.removerApiKey) estado.chaveGuardada = null;
      estado.recebimento = {
        habilitado: true, configurado: true, infiniteTag: tag, apiKeyConfigurada: temChave, jurosDoParcelamento: juros,
        versao: atual.configurado ? (atual.versao ?? 0) + 1 : 0,
      };
      return json(route, estado.recebimento);
    },
    'DELETE /financeiro/recebimento-online': (p, route) => {
      const versao = p.busca.get('versao');
      if (estado.recebimento.configurado && versao !== null && Number(versao) !== estado.recebimento.versao) return conflito(route);
      estado.recebimento = { ...RECEBIMENTO_NAO_CONFIGURADO };
      estado.chaveGuardada = null;
      return route.fulfill({ status: 204 });
    },
    'POST /cobrancas/{id}/link': (p, route) => {
      const id = p.caminho.split('/')[2];
      const cobranca = estado.cobrancas.find((x) => x.id === id);
      // Mesma ordem do servidor: cobrança (404), aberta (409) e só então a credencial (409).
      if (!cobranca) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (cobranca.situacao !== 'ABERTA') return json(route, erroApi(409, 'A cobrança não está em aberto.', 'COBRANCA_NAO_ABERTA').corpo, 409);
      if (!estado.recebimento.configurado) {
        return json(route, erroApi(409, 'Configure o recebimento online antes de gerar o link.', 'RECEBIMENTO_ONLINE_NAO_CONFIGURADO').corpo, 409);
      }
      return json(route, { url: LINK_DE_PAGAMENTO });
    },
    'POST /aluno/financeiro/cobrancas/{id}/link': (p, route) => {
      const id = p.caminho.split('/')[4];
      const cobranca = estado.cobrancas.find((x) => x.id === id);
      if (!cobranca) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      if (cobranca.situacao !== 'ABERTA') return json(route, erroApi(409, 'A cobrança não está em aberto.', 'COBRANCA_NAO_ABERTA').corpo, 409);
      if (!estado.pagamentoOnline) {
        return json(route, erroApi(409, 'O recebimento online não está configurado.', 'RECEBIMENTO_ONLINE_NAO_CONFIGURADO').corpo, 409);
      }
      return json(route, { url: LINK_DE_PAGAMENTO });
    },
    // A volta do navegador: cobrança que não é do aluno (aqui, id que não existe) = 404; senão 204 e o pedido fica guardado.
    'POST /aluno/financeiro/retorno-pagamento': (p, route) => {
      const c = p.corpo as { orderNsu?: string; transactionNsu?: string };
      if (!c.orderNsu || !c.transactionNsu) return json(route, erroApi(400, 'Pedido inválido.', 'REQUISICAO_INVALIDA').corpo, 400);
      estado.retornos.push(p.corpo);
      if (!estado.cobrancas.some((x) => x.id === c.orderNsu)) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      return route.fulfill({ status: 204 });
    },
    'GET /financeiro/lembretes': (_p, route) => json(route, estado.lembretes),
    // Mesmas regras do servidor: versão nula só na criação; dias de 0 a 15 e de 0 a 30 (422 com o campo).
    'PUT /financeiro/lembretes': (p, route) => {
      const c = p.corpo as Omit<Lembretes, 'emailDisponivel'>;
      if (c.versao !== estado.lembretes.versao) return conflito(route);
      const erros = [
        ...(c.diasAntes < 0 || c.diasAntes > 15 ? [{ field: 'diasAntes', message: 'Use de 0 a 15 dias.' }] : []),
        ...(c.diasDepois < 0 || c.diasDepois > 30 ? [{ field: 'diasDepois', message: 'Use de 0 a 30 dias.' }] : []),
      ];
      if (erros.length) {
        return json(route, { status: 422, message: 'Confira os lembretes de cobrança.', codigo: 'LEMBRETES_INVALIDOS', fieldErrors: erros }, 422);
      }
      estado.lembretes = {
        ligado: c.ligado, diasAntes: c.diasAntes, noDia: c.noDia, diasDepois: c.diasDepois,
        versao: estado.lembretes.versao === null ? 0 : estado.lembretes.versao + 1, emailDisponivel: estado.lembretes.emailDisponivel,
      };
      return json(route, estado.lembretes);
    },
    'GET /aluno/lembretes-de-cobranca': (_p, route) => json(route, { receber: estado.alunoRecebeLembretes }),
    'PUT /aluno/lembretes-de-cobranca': (p, route) => {
      estado.pedidosDeLembretesDoAluno.push(p.corpo);
      if (estado.falhaAoDefinirLembretesDoAluno) {
        return json(route, erroApi(503, estado.falhaAoDefinirLembretesDoAluno, 'PROVEDOR_INDISPONIVEL').corpo, 503);
      }
      estado.alunoRecebeLembretes = (p.corpo as { receber: boolean }).receber;
      return json(route, { receber: estado.alunoRecebeLembretes });
    },
    'GET /cobrancas/{id}/lembretes': (p, route) => {
      const id = p.caminho.split('/')[2];
      if (!estado.cobrancas.some((x) => x.id === id)) return json(route, erroApi(404, 'Cobrança não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      return json(route, estado.lembretesDasCobrancas[id] ?? { itens: [], whatsapp: null, motivoSemWhatsapp: null, alunoDesligou: false, paraResponsavel: false });
    },
    'GET /financeiro/conferencias': (_p, route) => json(route, { itens: estado.conferencias }),
    'POST /financeiro/conferencias/{id}/conferido': (p, route) => {
      const id = p.caminho.split('/')[3];
      if (!estado.conferencias.some((x) => x.id === id)) {
        return json(route, erroApi(404, 'Conferência não encontrada.', 'NAO_ENCONTRADO').corpo, 404);
      }
      estado.conferencias = estado.conferencias.filter((x) => x.id !== id);
      return route.fulfill({ status: 204 });
    },
  };
}

/**
 * Responsável financeiro do aluno (D15) em memória, à parte do `EstadoFinanceiro` (some a outra pessoa mudando no meio:
 * o teste troca `responsavel` e a `versao` velha da tela dá 409, como no servidor). `veCpf` imita `ALUNO_SENSIVEL_LER`:
 * sem ela o GET manda `cpf` nulo e o PUT ignora o do corpo. Só dados fictícios.
 */
export interface EstadoDoResponsavel {
  responsavel: ResponsavelFinanceiro;
  veCpf: boolean;
  /** Preenchida: o próximo PUT ou DELETE responde este erro (uma vez). */
  recusa: { status: number; codigo: string; fieldErrors?: { field: string; message: string }[] } | null;
  puts: ResponsavelFinanceiroRequest[];
  deletes: (string | null)[];
}

export const SEM_RESPONSAVEL: ResponsavelFinanceiro = { nome: null, parentesco: null, cpf: null, telefone: null, email: null, versao: null, atualizadoEm: null };

export const estadoDoResponsavel = (parcial: Partial<EstadoDoResponsavel> = {}): EstadoDoResponsavel =>
  ({ responsavel: { ...SEM_RESPONSAVEL }, veCpf: true, recusa: null, puts: [], deletes: [], ...parcial });

export function rotasDoResponsavel(estado: EstadoDoResponsavel): RespostasApi {
  const visto = () => (estado.veCpf ? estado.responsavel : { ...estado.responsavel, cpf: null });
  const recusar = (route: Route) => {
    const r = estado.recusa;
    if (!r) return null;
    estado.recusa = null;
    return json(route, erroApi(r.status, 'Recusado pelo servidor.', r.codigo, r.fieldErrors ?? []).corpo, r.status);
  };
  return {
    'GET /alunos/{id}/responsavel-financeiro': (_p, route) => json(route, visto()),
    'PUT /alunos/{id}/responsavel-financeiro': (p, route) => {
      const c = p.corpo as ResponsavelFinanceiroRequest;
      estado.puts.push(c);
      const recusa = recusar(route);
      if (recusa) return recusa;
      if (c.versao !== estado.responsavel.versao) return conflito(route);
      const cpf = estado.veCpf ? c.cpf : estado.responsavel.cpf;
      estado.responsavel = { ...c, cpf, versao: (estado.responsavel.versao ?? -1) + 1, atualizadoEm: '2026-10-19T15:00:00Z' };
      return json(route, visto());
    },
    'DELETE /alunos/{id}/responsavel-financeiro': (p, route) => {
      estado.deletes.push(p.busca.get('versao'));
      const recusa = recusar(route);
      if (recusa) return recusa;
      const versao = p.busca.get('versao');
      if (versao !== null && Number(versao) !== estado.responsavel.versao && estado.responsavel.versao !== null) return conflito(route);
      estado.responsavel = { ...SEM_RESPONSAVEL };
      return route.fulfill({ status: 204 });
    },
  };
}
