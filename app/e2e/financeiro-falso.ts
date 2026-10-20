import type { Page, Route } from '@playwright/test';

import type {
  CobrancaDoAluno, CobrancaResponse, ContratacaoResponse, FinanceiroDoAluno, Inadimplente, LancamentoResponse, Painel, PlanoResponse,
} from '../src/api/financeiroTipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * API falsa do financeiro (pagamentos do aluno ao treinador), com estado em memória: criar plano, contratar (gera a
 * primeira cobrança), dar baixa manual, lançamentos avulsos, painel e a visão do aluno (`GET /aluno/financeiro`).
 * Mesmos contratos de `PagamentosDtos`. Dinheiro em centavos; o valor da cobrança sai do plano ou da contratação,
 * nunca do corpo da baixa. Só dados fictícios.
 */

export const ALUNO_FINANCEIRO_ID = 'a0000000-0000-4000-8000-000000000002';

/** Permissões do financeiro; o módulo ligado vai em `pagamentosHabilitados` do `/eu`. */
export const PERMISSOES_FINANCEIRO = ['FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'];

/** Sessão do treinador com o módulo de pagamentos ligado e as permissões do financeiro. */
export function sessaoComFinanceiro(page: Page, permissoes: string[] = PERMISSOES_FINANCEIRO): Promise<RespostasApi> {
  return sessao(page, TREINADOR, { pagamentosHabilitados: true, permissoes: [...PERMISSOES_TREINADOR, ...permissoes] });
}

const ROTULO_RESULTADO = 'Resultado do mês (entradas − saídas registradas)';

/** Painel sem nenhum dado: tudo nulo ou vazio, como a API devolve numa consultoria nova. */
export const PAINEL_VAZIO: Painel = {
  periodo: { de: '2026-05-01', ate: '2026-10-31' },
  somenteMeus: false,
  cartoes: {
    recebidoCentavos: null, aReceberCentavos: null, emAtraso: { valorCentavos: null, cobrancas: 0 }, receitaRecorrenteMensalCentavos: null,
    alunosPagantes: null, valorMedioPorAlunoCentavos: null,
  },
  serie: [],
  inadimplencia: { percentual: null, vencidoCentavos: null, cobradoCentavos: null },
  porForma: [],
  porPlano: [],
  movimentoDeAlunos: [],
  proximosRecebimentos: { fonte: 'VENCIMENTO', em7Dias: { valorCentavos: null, cobrancas: 0 }, em30Dias: { valorCentavos: null, cobrancas: 0 } },
  resultadoDoMes: {
    rotulo: ROTULO_RESULTADO, mes: '2026-10', recebidoCentavos: null, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null, resultadoCentavos: null,
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
  baixaPorNome: null, observacao: null, motivo: null, versao: 0,
};

/** Estado em memória do financeiro falso: o mesmo objeto serve à página do treinador e à do aluno no mesmo teste. */
export interface EstadoFinanceiro {
  planos: PlanoResponse[];
  contratacoes: ContratacaoResponse[];
  cobrancas: CobrancaResponse[];
  lancamentos: LancamentoResponse[];
  inadimplentes: Inadimplente[];
  painel: Painel;
}

export function estadoFinanceiro(parcial: Partial<EstadoFinanceiro> = {}): EstadoFinanceiro {
  return { planos: [], contratacoes: [], cobrancas: [], lancamentos: [], inadimplentes: [], painel: PAINEL_COM_DADOS, ...parcial };
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

const conflito = (route: Route) => json(route, erroApi(409, 'Alguém alterou este registro.', 'CONFLITO_EDICAO').corpo, 409);

/** Rotas do financeiro para somar ao mapa de `simularApi`. */
export function rotasDoFinanceiro(estado: EstadoFinanceiro): RespostasApi {
  return {
    'GET /financeiro/planos': (p, route) =>
      json(route, estado.planos.filter((x) => p.busca.get('arquivados') === 'true' || !x.arquivado)),
    'POST /financeiro/planos': (p, route) => {
      const c = p.corpo as { nome: string; valorCentavos: number; periodicidade: PlanoResponse['periodicidade'] };
      const plano: PlanoResponse = {
        id: idFalso('b'), nome: c.nome, valorCentavos: c.valorCentavos, periodicidade: c.periodicidade, aceitaPix: true, aceitaBoleto: false,
        aceitaCartao: true, aceitaManual: true, maxParcelas: 1, taxaCartao: 'TREINADOR', arquivado: false, criadoEm: '2026-10-19T12:00:00Z', versao: 0,
      };
      estado.planos.push(plano);
      return json(route, plano, 201);
    },
    'GET /financeiro/cobrancas': (p, route) => {
      const situacao = p.busca.get('situacao');
      const itens = estado.cobrancas.filter((c) => !situacao || (situacao === 'VENCIDA' ? c.situacao === 'ABERTA' && c.vencida : c.situacao === situacao));
      return json(route, { itens, total: itens.length, pagina: 0 });
    },
    'GET /financeiro/inadimplentes': (_p, route) => json(route, {
      itens: estado.inadimplentes,
      total: estado.inadimplentes.length,
      valorTotalCentavos: estado.inadimplentes.length ? estado.inadimplentes.reduce((s, i) => s + i.valorCentavos, 0) : null,
      pagina: 0,
    }),
    'GET /financeiro/painel': (p, route) => json(route, { ...estado.painel, somenteMeus: p.busca.get('meus') === 'true' }),
    'GET /financeiro/lancamentos': (_p, route) => json(route, { itens: estado.lancamentos, total: estado.lancamentos.length, pagina: 0 }),
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
    'POST /alunos/{id}/contratacoes': (p, route) => {
      const c = p.corpo as { planoComercialId: string; valorCentavos?: number | null; motivoValor?: string | null; inicio: string; diaVencimento: number };
      const plano = estado.planos.find((x) => x.id === c.planoComercialId);
      if (!plano) return json(route, erroApi(404, 'Plano comercial não encontrado.', 'NAO_ENCONTRADO').corpo, 404);
      if (estado.contratacoes.some((x) => x.situacao !== 'ENCERRADA')) {
        return json(route, erroApi(409, 'O aluno já tem um plano vigente.', 'CONTRATACAO_VIGENTE').corpo, 409);
      }
      const valorCentavos = c.valorCentavos ?? plano.valorCentavos;
      const contratacao: ContratacaoResponse = {
        id: idFalso('e'), alunoId: ALUNO_FINANCEIRO_ID, planoComercialId: plano.id, planoNome: plano.nome, periodicidade: plano.periodicidade,
        valorCentavos, motivoValor: c.motivoValor ?? null, inicio: c.inicio, diaVencimento: c.diaVencimento, situacao: 'ATIVA', encerradaEm: null,
        criadoEm: '2026-10-19T12:00:00Z', versao: 0,
      };
      estado.contratacoes.push(contratacao);
      const [ano, mes] = c.inicio.split('-').map(Number);
      const dia = Math.min(c.diaVencimento, ultimoDia(ano, mes));
      const vencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const vencida = vencimento < HOJE;
      estado.cobrancas.push({
        id: idFalso('c'), contratacaoId: contratacao.id, alunoId: ALUNO_FINANCEIRO_ID, alunoNome: ALUNO.nome, planoNome: plano.nome,
        competencia: c.inicio, vencimento, valorCentavos, situacao: 'ABERTA', vencida, diasDeAtraso: vencida ? 1 : null, forma: null, provedor: null,
        pagoEm: null, baixaPor: null, baixaPorNome: null, observacao: null, motivo: null, versao: 0,
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
    'GET /aluno/financeiro': (_p, route) => {
      const vigente = estado.contratacoes.find((x) => x.situacao !== 'ENCERRADA') ?? null;
      const doAluno = (c: CobrancaResponse): CobrancaDoAluno => ({
        id: c.id, competencia: c.competencia, vencimento: c.vencimento, valorCentavos: c.valorCentavos, situacao: c.situacao, vencida: c.vencida,
        forma: c.forma, pagoEm: c.pagoEm,
      });
      const corpo: FinanceiroDoAluno = {
        plano: vigente
          ? {
              contratacaoId: vigente.id, planoNome: vigente.planoNome, valorCentavos: vigente.valorCentavos, periodicidade: vigente.periodicidade,
              situacao: vigente.situacao, proximoVencimento: estado.cobrancas.find((c) => c.situacao === 'ABERTA')?.vencimento ?? null,
            }
          : null,
        abertas: estado.cobrancas.filter((c) => c.situacao === 'ABERTA').map(doAluno),
        historico: estado.cobrancas.filter((c) => c.situacao !== 'ABERTA').map(doAluno),
      };
      return json(route, corpo);
    },
  };
}
