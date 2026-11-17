import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

import type { CobrancaAvulsaRequest, CobrancaAvulsaResponse } from '../api/financeiroTipos';
import { dataNaFaixa, mensagemDaFaixa } from './datasValidas';
import { hojeEmBrasilia, validarValor } from './financeiro';
import { centavosDaTela, centavosParaTela, dataDaTela, dataParaTela } from './formatos';
import { somarMeses } from './saidaDoPlano';

/**
 * Cobrança avulsa (Fase 1 do financeiro, `docs/planos/financeiro-em-fases.md`): 1 a 100 alunos de uma vez, tudo ou nada.
 * Segunda exceção à regra "o valor da cobrança é do servidor" (D5): o `valorCentavos` do corpo é o de CADA cobrança (cada
 * parcela de cada aluno). Aqui só se valida a entrada, se monta o corpo e se traduz o erro; o servidor confere de novo e
 * decide o que gera. Dinheiro em centavos inteiros; mensagens nunca repetem o que a pessoa digitou.
 */

export const LIMITES_DA_AVULSA = { alunos: 100, descricao: 120, parcelas: 12 } as const;

export type CampoDaAvulsa = 'alunos' | 'descricao' | 'valor' | 'primeiroVencimento' | 'parcelas';
export type ErrosDaAvulsa = Partial<Record<CampoDaAvulsa, string>>;

/** As três etapas do passo a passo e os campos de cada uma. */
export type EtapaDaAvulsa = 1 | 2 | 3;
export const CAMPOS_DA_ETAPA: Readonly<Record<EtapaDaAvulsa, readonly CampoDaAvulsa[]>> = {
  1: ['alunos'],
  2: ['descricao', 'valor'],
  3: ['primeiroVencimento', 'parcelas'],
};

export interface EntradaDaAvulsa {
  alunoIds: readonly string[];
  descricao: string;
  /** O que o campo "Valor" mostra, em reais com vírgula (`150,00`). */
  valorTexto: string;
  /** `DD/MM/AAAA`. */
  primeiroVencimentoTexto: string;
  /** Inteiro de 1 a 12, como texto do campo. */
  parcelasTexto: string;
}

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

export const MENSAGEM_PARCELAS = `As parcelas vão de 1 a ${LIMITES_DA_AVULSA.parcelas}.`;

function lerParcelas(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= LIMITES_DA_AVULSA.parcelas ? n : null;
}

function validarVencimento(texto: string, hoje: string): { iso: string | null; erro: string | null } {
  if (!texto.trim()) return { iso: null, erro: 'Informe o primeiro vencimento.' };
  const iso = dataDaTela(texto);
  if (iso === undefined) return { iso: null, erro: texto.trim().length === 10 ? 'Data inválida.' : 'Informe a data completa, como 05/12/2026.' };
  if (iso === null) return { iso: null, erro: 'Informe o primeiro vencimento.' };
  if (!dataNaFaixa(iso, 'PLANEJAMENTO', hoje)) return { iso: null, erro: mensagemDaFaixa('Primeiro vencimento', 'PLANEJAMENTO', hoje) };
  return { iso, erro: null };
}

export type CorpoDaAvulsa = { ok: true; corpo: CobrancaAvulsaRequest } | { ok: false; erros: ErrosDaAvulsa };

/**
 * Valida tudo e monta o corpo. Alunos: 1 a 100 sem repetir; descrição de 1 a 120 depois do strip; valor de R$ 0,01 a
 * R$ 10.000.000,00 lido em reais com vírgula para centavos exatos; primeiro vencimento na faixa PLANEJAMENTO (a de
 * `datasValidas`); parcelas de 1 a 12. `hoje` é o de Brasília.
 */
export function corpoDaAvulsa(entrada: EntradaDaAvulsa, hoje: string = hojeEmBrasilia()): CorpoDaAvulsa {
  const erros: ErrosDaAvulsa = {};
  const ids = entrada.alunoIds;
  if (ids.length === 0) erros.alunos = 'Escolha ao menos um aluno.';
  else if (ids.length > LIMITES_DA_AVULSA.alunos) {
    erros.alunos = `O limite é de ${LIMITES_DA_AVULSA.alunos} alunos por vez. Tire ${plural(ids.length - LIMITES_DA_AVULSA.alunos, 'aluno', 'alunos')} da seleção.`;
  } else if (new Set(ids).size !== ids.length) erros.alunos = 'Há aluno repetido na seleção.';

  const descricao = entrada.descricao.trim();
  if (!descricao) erros.descricao = 'Descreva a cobrança.';
  else if (descricao.length > LIMITES_DA_AVULSA.descricao) erros.descricao = `A descrição pode ter até ${LIMITES_DA_AVULSA.descricao} caracteres.`;

  const valorCentavos = centavosDaTela(entrada.valorTexto);
  const erroDoValor = validarValor(valorCentavos);
  if (erroDoValor) erros.valor = erroDoValor;

  const vencimento = validarVencimento(entrada.primeiroVencimentoTexto, hoje);
  if (vencimento.erro) erros.primeiroVencimento = vencimento.erro;

  const parcelas = lerParcelas(entrada.parcelasTexto);
  if (parcelas === null) erros.parcelas = MENSAGEM_PARCELAS;

  if (Object.keys(erros).length > 0 || valorCentavos === null || vencimento.iso === null || parcelas === null) return { ok: false, erros };
  return { ok: true, corpo: { alunoIds: [...ids], descricao, valorCentavos, primeiroVencimento: vencimento.iso, parcelas } };
}

/** Só os erros dos campos da etapa: o "Continuar" de cada etapa trava por eles. */
export function errosDaEtapa(etapa: EtapaDaAvulsa, entrada: EntradaDaAvulsa, hoje: string = hojeEmBrasilia()): ErrosDaAvulsa {
  const resultado = corpoDaAvulsa(entrada, hoje);
  if (resultado.ok) return {};
  const erros: ErrosDaAvulsa = {};
  for (const campo of CAMPOS_DA_ETAPA[etapa]) if (resultado.erros[campo]) erros[campo] = resultado.erros[campo];
  return erros;
}

/** A primeira etapa que tem erro (para voltar a ela), ou `null`. */
export function primeiraEtapaComErro(erros: ErrosDaAvulsa): EtapaDaAvulsa | null {
  for (const etapa of [1, 2, 3] as const) if (CAMPOS_DA_ETAPA[etapa].some((c) => erros[c])) return etapa;
  return null;
}

// ---- Prévia e confirmação ----

export interface ParcelaDaPrevia {
  numero: number;
  de: number;
  /** `AAAA-MM-DD`. */
  vencimento: string;
  /** Como o servidor grava: `<descricao> (Parcela k/n)` só com mais de uma parcela. */
  descricao: string;
}

/**
 * As parcelas como o servidor as gera: a k-ésima vence no primeiro vencimento + (k-1) meses, com o dia preso ao último do
 * mês (31/01, 28/02, 31/03: sempre contado do primeiro, nunca encadeado). É só conferência: quem gera é o servidor.
 */
export function previaDasParcelas(primeiroVencimento: string, parcelas: number, descricao: string): ParcelaDaPrevia[] {
  const texto = descricao.trim();
  return Array.from({ length: parcelas }, (_, i) => ({
    numero: i + 1,
    de: parcelas,
    vencimento: somarMeses(primeiroVencimento, i),
    descricao: parcelas > 1 ? `${texto} (Parcela ${i + 1}/${parcelas})` : texto,
  }));
}

/** Quantas cobranças o envio gera: alunos × parcelas. */
export const quantidadeDeCobrancas = (c: Pick<CobrancaAvulsaRequest, 'alunoIds' | 'parcelas'>): number => c.alunoIds.length * c.parcelas;

/**
 * O painel de confirmação: título "Gerar N cobranças?" (N = alunos × parcelas) e o detalhe com o total em reais
 * (valor × N, só conferência: cada cobrança leva o valor digitado) e o primeiro vencimento.
 */
export function confirmacaoDaAvulsa(corpo: CobrancaAvulsaRequest): { titulo: string; detalhe: string } {
  const n = quantidadeDeCobrancas(corpo);
  const alunos = plural(corpo.alunoIds.length, 'aluno', 'alunos');
  const quantas = corpo.parcelas > 1 ? `${alunos} × ${corpo.parcelas} parcelas de ${centavosParaTela(corpo.valorCentavos)}` : `${alunos} × ${centavosParaTela(corpo.valorCentavos)}`;
  return {
    titulo: `Gerar ${plural(n, 'cobrança', 'cobranças')}?`,
    detalhe: `${quantas}: total de ${centavosParaTela(corpo.valorCentavos * n)}. O primeiro vencimento é ${dataParaTela(corpo.primeiroVencimento)}.`,
  };
}

/** O aviso depois do 201: "6 cobranças geradas para 2 alunos." */
export function textoDaAvulsaGerada(r: CobrancaAvulsaResponse): string {
  return `${plural(r.cobrancas, 'cobrança gerada', 'cobranças geradas')} para ${plural(r.alunos, 'aluno', 'alunos')}.`;
}

// ---- Erros ----

export const MENSAGEM_CAMPOS_DA_AVULSA = 'Confira os campos destacados.';
export const MENSAGEM_ALUNO_NAO_ENCONTRADO = 'Algum aluno da seleção não foi encontrado. Nenhuma cobrança foi gerada. Atualize a lista de alunos e tente de novo.';
export const MENSAGEM_ALUNO_INATIVO = 'Algum aluno da seleção está inativo. Nenhuma cobrança foi gerada. Tire-o da seleção ou reative-o.';
export const MENSAGEM_ALUNO_ANONIMIZADO = 'Algum aluno da seleção foi anonimizado e não recebe cobrança. Nenhuma cobrança foi gerada. Tire-o da seleção.';
/** Sem retorno do servidor não dá para saber se gerou (não há chave de idempotência): conferir antes de repetir. */
export const MENSAGEM_CONFERIR_A_LISTA = 'Não foi possível confirmar se as cobranças foram geradas. Confira a lista de cobranças antes de tentar de novo.';

const CAMPOS_DA_API: Readonly<Record<string, CampoDaAvulsa>> = {
  descricao: 'descricao',
  valorCentavos: 'valor',
  primeiroVencimento: 'primeiroVencimento',
  parcelas: 'parcelas',
};

export interface ErroDaAvulsa {
  mensagem: string;
  campos: ErrosDaAvulsa;
  /** A etapa em que está o primeiro campo com erro (o passo a passo volta a ela); nulo se não há campo. */
  etapa: EtapaDaAvulsa | null;
  /** A lista de alunos mudou (404, inativo, anonimizado): a tela a busca de novo e o treinador revê a seleção. */
  recarregarAlunos: boolean;
}

function statusDoErro(erro: unknown): number | null {
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  return typeof status === 'number' ? status : null;
}

/**
 * Tradução do erro do `POST /financeiro/cobrancas-avulsas`: 422 `COBRANCA_AVULSA_INVALIDA` por campo (`alunoIds` e
 * `alunoIds[i]` viram o campo `alunos`; campo que a tela não mostra vai ao texto geral), 404 (aluno de outra consultoria ou
 * inexistente), 409 `ALUNO_INATIVO` e `ALUNO_ANONIMIZADO`, o texto da API em 403, 503 `FINANCEIRO_INDISPONIVEL`, e sem conexão
 * ou erro desconhecido a frase de conferir a lista. Nunca repete o que foi digitado.
 */
export function traduzirErroDaAvulsa(erro: unknown): ErroDaAvulsa {
  const base = { campos: {} as ErrosDaAvulsa, etapa: null, recarregarAlunos: false };
  const codigo = codigoApi(erro);
  const status = statusDoErro(erro);
  if (codigo === 'COBRANCA_AVULSA_INVALIDA') {
    const campos: ErrosDaAvulsa = {};
    const fora: string[] = [];
    for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
      const nosso = campo.startsWith('alunoIds') ? 'alunos' : CAMPOS_DA_API[campo];
      if (nosso) campos[nosso] ??= mensagem;
      else fora.push(mensagem);
    }
    const etapa = primeiraEtapaComErro(campos);
    if (fora.length > 0) return { ...base, mensagem: fora.join(' '), campos, etapa };
    if (etapa === null) return { ...base, mensagem: mensagemApi(erro, MENSAGEM_CAMPOS_DA_AVULSA), campos };
    return { ...base, mensagem: MENSAGEM_CAMPOS_DA_AVULSA, campos, etapa };
  }
  if (status === 404) return { ...base, mensagem: MENSAGEM_ALUNO_NAO_ENCONTRADO, recarregarAlunos: true };
  if (codigo === 'ALUNO_INATIVO') return { ...base, mensagem: MENSAGEM_ALUNO_INATIVO, recarregarAlunos: true };
  if (codigo === 'ALUNO_ANONIMIZADO') return { ...base, mensagem: MENSAGEM_ALUNO_ANONIMIZADO, recarregarAlunos: true };
  // 403 e 503 não gravam nada: a frase da API basta. Sem conexão pode ter gravado: a de conferir.
  if (status === 403 || codigo === 'FINANCEIRO_INDISPONIVEL') return { ...base, mensagem: mensagemApi(erro, 'Não foi possível gerar as cobranças agora. Nenhuma foi gerada.') };
  if (erroDeConexao(erro)) return { ...base, mensagem: `${mensagemApi(erro, '')} ${MENSAGEM_CONFERIR_A_LISTA}`.trim() };
  return { ...base, mensagem: MENSAGEM_CONFERIR_A_LISTA };
}
