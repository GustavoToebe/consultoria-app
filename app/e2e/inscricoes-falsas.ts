import type { ContagensInscricoes, InscricaoDetalhe, InscricaoResumo } from '../src/api/inscricoesTipos';
import { type RespostasApi, TREINADOR } from './api-falsa';

/** Inscrições fictícias e as rotas que a tela Interessados sempre consulta. Só dados fictícios. */

export const CODIGO = 'codigo-de-teste-abcdefghijk';

export function idDe(n: number): string {
  return `i0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function resumoFalso(n: number, extra: Partial<InscricaoResumo> = {}): InscricaoResumo {
  return {
    id: idDe(n),
    nome: `Pessoa Fictícia ${n}`,
    objetivo: null,
    whatsapp: '(11) 98765-4321',
    email: null,
    situacao: 'NOVA',
    pagamento: 'NAO_CONTROLADO',
    responsavelId: null,
    responsavelNome: null,
    alunoId: null,
    criadaEm: '2026-10-18T13:00:00Z',
    ultimaAtividadeEm: '2026-10-18T13:00:00Z',
    ciclo: 1,
    origem: null,
    propostaPlanoNome: null,
    proximoRetorno: null,
    versao: 1,
    duplicidade: { alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 0 },
    ...extra,
  };
}

export function detalheFalso(r: InscricaoResumo, extra: Partial<InscricaoDetalhe> = {}): InscricaoDetalhe {
  const { proximoRetorno: _retorno, propostaPlanoNome: _plano, ...base } = r;
  return {
    ...base,
    observacao: null,
    interesse: null,
    modalidadeDesejada: null,
    previsaoInicio: null,
    origemInformada: null,
    origemLink: null,
    cienciaEm: null,
    cienciaTexto: null,
    motivoEncerramento: null,
    motivoDetalhe: null,
    encerradaEm: null,
    encerradaPorNome: null,
    pagamentoConfirmadoPorNome: null,
    pagamentoConfirmadoEm: null,
    aceitaEm: null,
    relacionadaA: null,
    proposta: {
      planoId: null, planoNome: null, modalidade: null, periodicidade: null, valorReferenciaCentavos: null, valorCentavos: null,
      condicoes: null, atualizadaEm: null, atualizadaPorNome: null,
    },
    atualizadaEm: '2026-10-18T13:00:00Z',
    notas: [],
    retornos: [],
    eventos: [],
    ...extra,
  };
}

export function contagensFalsas(extra: Partial<ContagensInscricoes['porSituacao']> = {}, retornos: Partial<Pick<ContagensInscricoes, 'retornosAtrasados' | 'retornosHoje'>> = {}): ContagensInscricoes {
  const porSituacao = { NOVA: 0, EM_CONTATO: 0, EM_NEGOCIACAO: 0, ACEITA: 0, RECUSADA: 0, DESISTIU: 0, ...extra };
  const abertas = porSituacao.NOVA + porSituacao.EM_CONTATO + porSituacao.EM_NEGOCIACAO;
  const todas = abertas + porSituacao.ACEITA + porSituacao.RECUSADA + porSituacao.DESISTIU;
  return { porSituacao, abertas, todas, retornosAtrasados: 0, retornosHoje: 0, ...retornos };
}

/** Rotas de apoio da tela (link, equipe, contagens, retornos); quem testa soma as da lista e da inscrição. */
export function rotasDaTela(extra: RespostasApi = {}): RespostasApi {
  return {
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /inscricoes/configuracao': {
      corpo: { aberta: true, codigo: CODIGO, link: `https://consultoria.exemplo.test/inscricao/${CODIGO}`, responsavelId: TREINADOR.id, texto: null, versao: 2 },
    },
    'GET /inscricoes/contagens': { corpo: contagensFalsas() },
    'GET /inscricoes/retornos': { corpo: [] },
    ...extra,
  };
}
