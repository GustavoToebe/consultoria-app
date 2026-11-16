import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

import type {
  EncerrarContratacaoRequest,
  OpcaoDaPrevia,
  OpcaoDeSaida,
  PeriodoDoPlano,
  PlanoResponse,
  PreviaDoEncerramento,
  ResumoDaSaidaDoAluno,
} from '../api/financeiroTipos';
import { hojeEmBrasilia, textoDeAbertasQueContinuam } from './financeiro';
import { centavosDaTela, centavosParaTela, dataDaTela, dataParaTela } from './formatos';

/**
 * Saída antes do tempo mínimo (P1.5, `docs/planos/saida-e-tempo-minimo.md`): regras puras do painel de encerrar, do tempo
 * mínimo no plano e na contratação e do painel de inativar. REGRA DE OURO: o app nunca calcula dinheiro, multa nem
 * percentual. Todo valor vem da API (`PreviaDoEncerramento`, `ResumoDaSaidaDoAluno`) e aqui só vira texto; a única conta
 * deste módulo é de datas (faixas de vencimento e de `minimoAte`) e de contagem de cobranças já separadas pela API.
 */

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

// ---- Datas ----

/** `AAAA-MM-DD` + `n` meses, preso ao último dia do mês (31/01 + 1 = 28/02), como o `plusMonths` da API. */
export function somarMeses(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const indice = a * 12 + (m - 1) + n;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

export interface DataValidada {
  /** `AAAA-MM-DD`, ou `null` quando o campo está vazio. */
  iso: string | null;
  erro: string | null;
}

const DATA_INVALIDA = 'Data inválida.';
export const MENSAGEM_VENCIMENTO_DA_SAIDA = 'O vencimento vai de hoje até um ano à frente.';

/**
 * "Vence em" da cobrança de saída (`DD/MM/AAAA`): de hoje (Brasília) a hoje + 1 ano, como a API. Vazio é válido (`iso` nulo =
 * a API usa hoje). O mesmo dia ainda não é vencida.
 */
export function validarVencimentoDaSaida(texto: string, hoje: string = hojeEmBrasilia()): DataValidada {
  const iso = dataDaTela(texto);
  if (iso === null) return { iso: null, erro: null };
  if (iso === undefined) return { iso: null, erro: DATA_INVALIDA };
  if (iso < hoje || iso > somarMeses(hoje, 12)) return { iso: null, erro: MENSAGEM_VENCIMENTO_DA_SAIDA };
  return { iso, erro: null };
}

// ---- Tipos e rótulos (selo/rótulo do tipo da cobrança vivem em `financeiro.ts`) ----

export const ROTULO_DA_OPCAO: Readonly<Record<OpcaoDeSaida, string>> = {
  FALTAM: 'Meses que faltam para o mínimo',
  VIGENTE: 'Mês vigente',
  OUTRO: 'Outro valor',
  NAO_COBRAR: 'Não cobrar',
};

/** Teto único das opções com valor (R$ 1.000.000,00), o mesmo da API. */
export const VALOR_MAXIMO_DA_SAIDA_CENTAVOS = 100_000_000;
export const MENSAGEM_VALOR_DA_SAIDA = 'Informe um valor maior que zero, até R$ 1.000.000,00.';
export const MENSAGEM_OPCAO_INDISPONIVEL = 'Esta opção não está disponível.';

// ---- Painel de encerrar ----

export interface OpcaoDoPainel {
  opcao: OpcaoDeSaida;
  rotulo: string;
  disponivel: boolean;
  /** Texto da API quando indisponível. */
  motivo: string | null;
  /** Valor da API (`FALTAM` e `VIGENTE` disponíveis); nulo em `OUTRO` e `NAO_COBRAR`. */
  valorCentavos: number | null;
  /** O mesmo valor já formatado ("R$ 450,00"), ou nulo. */
  valor: string | null;
  /** `OUTRO`: o treinador digita o valor. Em `FALTAM`/`VIGENTE` o valor aparece só para leitura. */
  digitavel: boolean;
}

/** As opções na ordem da API, com o rótulo do app; opção que o app não conhece é ignorada. */
export function opcoesDoPainel(previa: Pick<PreviaDoEncerramento, 'opcoes'>): OpcaoDoPainel[] {
  return previa.opcoes
    .filter((o) => o.opcao in ROTULO_DA_OPCAO)
    .map((o) => ({
      opcao: o.opcao,
      rotulo: ROTULO_DA_OPCAO[o.opcao],
      disponivel: o.disponivel,
      motivo: o.disponivel ? null : (o.motivo ?? MENSAGEM_OPCAO_INDISPONIVEL),
      valorCentavos: o.disponivel ? o.valorCentavos : null,
      valor: o.disponivel && o.valorCentavos !== null ? centavosParaTela(o.valorCentavos) : null,
      digitavel: o.opcao === 'OUTRO',
    }));
}

/** O painel abre em "Não cobrar": cobrança de saída nunca é automática. */
export const OPCAO_INICIAL_DO_ENCERRAR: OpcaoDeSaida = 'NAO_COBRAR';

/**
 * "Faltam N meses para o mínimo (até dd/mm/aaaa)"; `N` = `mesesQueFaltam` da API. Sem mínimo, `null`. Mínimo sem meses a
 * cobrar: "Não faltam meses para o mínimo (até dd/mm/aaaa)".
 */
export function textoDosMesesQueFaltam(previa: Pick<PreviaDoEncerramento, 'minimoAte' | 'mesesQueFaltam'>): string | null {
  const ate = dataParaTela(previa.minimoAte);
  if (!ate) return null;
  if (previa.mesesQueFaltam <= 0) return `Não faltam meses para o mínimo (até ${ate})`;
  return previa.mesesQueFaltam === 1 ? `Falta 1 mês para o mínimo (até ${ate})` : `Faltam ${previa.mesesQueFaltam} meses para o mínimo (até ${ate})`;
}

/**
 * A conta de "Meses que faltam" em linhas, com os números do servidor (nada somado aqui; o total é o valor da opção
 * `FALTAM`): as mensalidades a vencer dentro do mínimo, que a opção cancela, e os meses ainda não gerados. Vazio quando não
 * há nenhum dos dois (sem mínimo, por exemplo).
 */
export function linhasDaConta(
  previa: Pick<PreviaDoEncerramento, 'aVencerNoMinimo' | 'mesesNaoGerados' | 'valorDosNaoGeradosCentavos'>,
): string[] {
  const linhas: string[] = [];
  const { quantidade, valorCentavos } = previa.aVencerNoMinimo;
  if (quantidade > 0) {
    linhas.push(`${plural(quantidade, 'mensalidade a vencer', 'mensalidades a vencer')} dentro do mínimo (${centavosParaTela(valorCentavos)}), ${quantidade === 1 ? 'cancelada' : 'canceladas'} ao cobrar a saída.`);
  }
  if (previa.mesesNaoGerados > 0) {
    linhas.push(`${plural(previa.mesesNaoGerados, 'mês ainda não gerado', 'meses ainda não gerados')} (${centavosParaTela(previa.valorDosNaoGeradosCentavos)}).`);
  }
  return linhas;
}

/**
 * Aviso de link vivo: só quando a opção `FALTAM` está escolhida e alguma das canceladas tem link de pagamento ainda válido
 * (`comLinkVivo` da API). `null` caso contrário.
 */
export function avisoDeLinkVivo(comLinkVivo: number): string | null {
  if (!Number.isFinite(comLinkVivo) || comLinkVivo <= 0) return null;
  const quais = comLinkVivo === 1 ? 'Uma das cobranças canceladas tem link de pagamento ainda válido' : `${comLinkVivo} das cobranças canceladas têm link de pagamento ainda válido`;
  return `${quais}. Se o aluno pagar por ele depois do cancelamento, o pagamento aparece em "Para conferir".`;
}

/** Quantas cobranças abertas continuam com a opção escolhida (contagem de grupos que a API já separou). */
export function abertasQueContinuamNaSaida(
  previa: Pick<PreviaDoEncerramento, 'vencidas' | 'aVencerNoMinimo' | 'aVencerQueFicam'>,
  opcao: OpcaoDeSaida,
): number {
  const base = previa.vencidas.quantidade + previa.aVencerQueFicam.quantidade;
  return opcao === 'FALTAM' ? base : base + previa.aVencerNoMinimo.quantidade;
}

/** A frase das abertas que continuam ("Há 1 cobrança aberta; ela continua valendo..."), ou `null` se não há nenhuma. */
export function fraseDasAbertasQueContinuam(
  previa: Pick<PreviaDoEncerramento, 'vencidas' | 'aVencerNoMinimo' | 'aVencerQueFicam'>,
  opcao: OpcaoDeSaida,
): string | null {
  return textoDeAbertasQueContinuam(abertasQueContinuamNaSaida(previa, opcao));
}

// ---- Corpo do encerrar ----

export interface EntradaDoEncerrar {
  opcao: OpcaoDeSaida;
  /** Texto do campo "Outro valor" (só `OUTRO`). */
  valorTexto: string;
  /** Texto do campo "Vence em" (`DD/MM/AAAA`; vazio = hoje). */
  vencimentoTexto: string;
}

export interface ErrosDoEncerrar {
  opcao?: string;
  valor?: string;
  vencimento?: string;
}

export type CorpoDoEncerrar = { ok: true; corpo: EncerrarContratacaoRequest } | { ok: false; erros: ErrosDoEncerrar };

/**
 * O corpo do `POST /contratacoes/{id}/encerrar` a partir da opção e dos campos. `NAO_COBRAR` manda só `{versao}`.
 * `FALTAM` leva o valor e os `cobrancasACancelar` da prévia; `VIGENTE` leva o valor da prévia e nenhuma lista (a API
 * responderia 409 com lista); `OUTRO` leva o valor digitado (> 0 e <= R$ 1.000.000,00). Opção indisponível ou "Vence em"
 * fora de hoje..+1 ano = `ok: false` com a mensagem por campo, e nada é enviado.
 */
export function corpoDoEncerrar(
  previa: Pick<PreviaDoEncerramento, 'opcoes' | 'cobrancasACancelar'>,
  entrada: EntradaDoEncerrar,
  versao: number,
  hoje: string = hojeEmBrasilia(),
): CorpoDoEncerrar {
  if (entrada.opcao === 'NAO_COBRAR') return { ok: true, corpo: { versao } };
  const erros: ErrosDoEncerrar = {};
  const vencimento = validarVencimentoDaSaida(entrada.vencimentoTexto, hoje);
  if (vencimento.erro) erros.vencimento = vencimento.erro;
  let valorCentavos: number | null = null;
  if (entrada.opcao === 'OUTRO') {
    valorCentavos = centavosDaTela(entrada.valorTexto);
    if (valorCentavos === null || valorCentavos > VALOR_MAXIMO_DA_SAIDA_CENTAVOS) erros.valor = MENSAGEM_VALOR_DA_SAIDA;
  } else {
    const da: OpcaoDaPrevia | undefined = previa.opcoes.find((o) => o.opcao === entrada.opcao);
    if (!da || !da.disponivel || da.valorCentavos === null) erros.opcao = da?.motivo ?? MENSAGEM_OPCAO_INDISPONIVEL;
    else valorCentavos = da.valorCentavos;
  }
  if (erros.opcao || erros.valor || erros.vencimento) return { ok: false, erros };
  return {
    ok: true,
    corpo: {
      versao,
      saida: {
        opcao: entrada.opcao,
        valorCentavos,
        vencimento: vencimento.iso,
        ...(entrada.opcao === 'FALTAM' ? { cobrancasACancelar: previa.cobrancasACancelar } : {}),
      },
    },
  };
}

// ---- Erros do encerrar ----

export const MENSAGEM_VALOR_DA_SAIDA_MUDOU = 'A conta da saída mudou. Confira os valores novos e confirme de novo.';
export const MENSAGEM_CONTRATACAO_ENCERRADA = 'Este plano já foi encerrado. Mostramos a situação atual.';
export const MENSAGEM_CONFLITO_DO_ENCERRAR = 'O plano foi alterado por outra pessoa. Mostramos os dados mais recentes.';
export const MENSAGEM_CAMPOS_DO_ENCERRAR = 'Confira os campos destacados.';
const MENSAGEM_PADRAO_DO_ENCERRAR = 'Não foi possível encerrar o plano. Tente de novo.';

export interface ErroDoEncerrar {
  mensagem: string;
  campos: ErrosDoEncerrar;
  /** A tela busca de novo a prévia (e a contratação, para a `versao`) antes de deixar tentar outra vez. */
  recarregar: boolean;
  /** Nada mais a fazer no painel: fecha (o plano já está encerrado). */
  fechar: boolean;
}

/**
 * Tradução do erro do encerrar e da prévia: 409 `VALOR_DA_SAIDA_MUDOU` (recarrega a prévia, sem fechar), 409
 * `CONTRATACAO_ENCERRADA` (recarrega e fecha), 409 `CONFLITO_EDICAO` (recarrega a contratação), 422 por campo
 * (`saida.opcao`, `saida.valorCentavos`, `saida.vencimento`) e o resto numa frase fixa, nunca com o que a pessoa digitou.
 */
export function traduzirErroDoEncerrar(erro: unknown): ErroDoEncerrar {
  const base = { campos: {}, recarregar: false, fechar: false };
  switch (codigoApi(erro)) {
    case 'VALOR_DA_SAIDA_MUDOU': return { ...base, mensagem: MENSAGEM_VALOR_DA_SAIDA_MUDOU, recarregar: true };
    case 'CONTRATACAO_ENCERRADA': return { ...base, mensagem: MENSAGEM_CONTRATACAO_ENCERRADA, recarregar: true, fechar: true };
    case 'CONFLITO_EDICAO': return { ...base, mensagem: MENSAGEM_CONFLITO_DO_ENCERRAR, recarregar: true };
    case 'CONTRATACAO_INVALIDA': {
      const c = errosPorCampo(erro);
      const campos: ErrosDoEncerrar = {};
      if (c['saida.opcao']) campos.opcao = c['saida.opcao'];
      if (c['saida.valorCentavos']) campos.valor = c['saida.valorCentavos'];
      if (c['saida.vencimento']) campos.vencimento = c['saida.vencimento'];
      return { ...base, mensagem: MENSAGEM_CAMPOS_DO_ENCERRAR, campos };
    }
    default: return { ...base, mensagem: erroDeConexao(erro) ? mensagemApi(erro, MENSAGEM_PADRAO_DO_ENCERRAR) : MENSAGEM_PADRAO_DO_ENCERRAR };
  }
}

// ---- Tempo mínimo e regra de saída no plano ----

export const TEMPO_MINIMO_MAXIMO_EM_MESES = 60;
export const REGRA_DE_SAIDA_MAXIMA = 500;
export const MENSAGEM_TEMPO_MINIMO = 'O tempo mínimo vai de 1 a 60 meses.';
export const MENSAGEM_REGRA_DE_SAIDA = `A regra de saída pode ter até ${REGRA_DE_SAIDA_MAXIMA} caracteres.`;

/** Tempo mínimo e regra de saída só existem em plano mensal (nas outras periodicidades o formulário não os mostra). */
export const planoPodeTerMinimo = (periodicidade: PeriodoDoPlano | null | undefined): boolean => periodicidade === 'MENSAL';

/** O que o formulário mostra ao abrir um plano: "" quando não há. */
export function minimoDoPlanoParaForm(plano: Pick<PlanoResponse, 'tempoMinimoMeses' | 'regraDeSaida'> | null | undefined): {
  tempoMinimoTexto: string;
  regraDeSaidaTexto: string;
} {
  return { tempoMinimoTexto: plano?.tempoMinimoMeses ? String(plano.tempoMinimoMeses) : '', regraDeSaidaTexto: plano?.regraDeSaida ?? '' };
}

export type MinimoDoPlanoParaEnvio =
  | { ok: true; tempoMinimoMeses: number | null; regraDeSaida: string | null }
  | { ok: false; erros: { tempoMinimo?: string; regraDeSaida?: string } };

/**
 * Os dois campos do plano para o `PlanoRequest`: em plano que não é mensal, os dois vão nulos (a API recusa mínimo ali);
 * no mensal, tempo vazio = sem mínimo, inteiro de 1 a 60; regra em branco vira nulo e vai até 500 caracteres.
 */
export function minimoDoPlanoParaEnvio(dados: { periodicidade: PeriodoDoPlano; tempoMinimoTexto: string; regraDeSaidaTexto: string }): MinimoDoPlanoParaEnvio {
  if (!planoPodeTerMinimo(dados.periodicidade)) return { ok: true, tempoMinimoMeses: null, regraDeSaida: null };
  const erros: { tempoMinimo?: string; regraDeSaida?: string } = {};
  const t = dados.tempoMinimoTexto.trim();
  let meses: number | null = null;
  if (t) {
    meses = /^\d{1,3}$/.test(t) ? Number(t) : NaN;
    if (!(meses >= 1 && meses <= TEMPO_MINIMO_MAXIMO_EM_MESES)) erros.tempoMinimo = MENSAGEM_TEMPO_MINIMO;
  }
  const regra = dados.regraDeSaidaTexto.trim();
  if (regra.length > REGRA_DE_SAIDA_MAXIMA) erros.regraDeSaida = MENSAGEM_REGRA_DE_SAIDA;
  if (erros.tempoMinimo || erros.regraDeSaida) return { ok: false, erros };
  return { ok: true, tempoMinimoMeses: meses, regraDeSaida: regra || null };
}

/** Os 422 `PLANO_INVALIDO` por campo do formulário do plano (`tempoMinimoMeses`, `regraDeSaida`). */
export function errosDoMinimoDoServidor(erro: unknown): { tempoMinimo?: string; regraDeSaida?: string } {
  const c = errosPorCampo(erro);
  const erros: { tempoMinimo?: string; regraDeSaida?: string } = {};
  if (c.tempoMinimoMeses) erros.tempoMinimo = c.tempoMinimoMeses;
  if (c.regraDeSaida) erros.regraDeSaida = c.regraDeSaida;
  return erros;
}

/** "Mínimo de 6 meses" na lista de planos; sem mínimo, `null`. */
export function textoDoMinimoDoPlano(plano: Pick<PlanoResponse, 'tempoMinimoMeses'>): string | null {
  const n = plano.tempoMinimoMeses;
  return n ? `Mínimo de ${plural(n, 'mês', 'meses')}` : null;
}

// ---- `minimoAte` da contratação ----

export const MENSAGEM_MINIMO_SO_NO_MENSAL = 'O tempo mínimo só vale em plano mensal.';

/**
 * "Fim do mínimo" (`DD/MM/AAAA`): do início da contratação a 60 meses depois (a API confere de novo). Vazio é válido e
 * APAGA o mínimo (`iso` nulo). O formulário envia sempre o resultado, nunca omite o campo.
 */
export function validarMinimoAte(texto: string, inicio: string): DataValidada {
  const iso = dataDaTela(texto);
  if (iso === null) return { iso: null, erro: null };
  if (iso === undefined) return { iso: null, erro: DATA_INVALIDA };
  const maximo = somarMeses(inicio, TEMPO_MINIMO_MAXIMO_EM_MESES);
  if (iso < inicio || iso > maximo) return { iso: null, erro: `O fim do mínimo vai de ${dataParaTela(inicio)} até ${dataParaTela(maximo)}.` };
  return { iso, erro: null };
}

/** "Tempo mínimo até 05/04/2027" ou "Sem tempo mínimo". */
export function textoDoMinimoAte(minimoAte: string | null | undefined): string {
  const ate = dataParaTela(minimoAte);
  return ate ? `Tempo mínimo até ${ate}` : 'Sem tempo mínimo';
}

// ---- Painel de inativar ----

export const TEXTO_GENERICO_DO_INATIVAR =
  'As cobranças que ainda não venceram serão canceladas. As vencidas e a cobrança de saída continuam em aberto.';

/**
 * As linhas do aviso do painel de inativar. Sem `FINANCEIRO_LER`, com o financeiro desligado ou sem o resumo (ainda
 * carregando ou falhou), o texto genérico, sem valores. Com o resumo: o que será cancelado, o que continua em aberto e,
 * se o mínimo se perde, o aviso (inativar nunca cobra a saída; é preciso encerrar o plano antes). Lista vazia = não há
 * nada em aberto nem mínimo: o painel não mostra nada.
 */
export function linhasDoPainelDeInativar(
  resumo: ResumoDaSaidaDoAluno | null | undefined,
  contexto: { podeLerFinanceiro: boolean; financeiroLigado: boolean },
): string[] {
  if (!contexto.podeLerFinanceiro || !contexto.financeiroLigado || !resumo) return [TEXTO_GENERICO_DO_INATIVAR];
  const linhas: string[] = [];
  const cancela = resumo.aCancelar;
  if (cancela.quantidade > 0) {
    linhas.push(`${plural(cancela.quantidade, 'mensalidade a vencer será cancelada', 'mensalidades a vencer serão canceladas')} (${centavosParaTela(cancela.valorCentavos)}).`);
  }
  const abertas = resumo.emAberto;
  if (abertas.quantidade > 0) {
    linhas.push(`${plural(abertas.quantidade, 'cobrança vencida ou de saída continua', 'cobranças vencidas ou de saída continuam')} em aberto (${centavosParaTela(abertas.valorCentavos)}). Dê baixa ou cancele depois, se precisar.`);
  }
  const ate = dataParaTela(resumo.minimoAte);
  if (resumo.mesesQueFaltam > 0 && ate) {
    const faltam = resumo.mesesQueFaltam === 1 ? 'Falta 1 mês' : `Faltam ${resumo.mesesQueFaltam} meses`;
    linhas.push(`${faltam} para o mínimo (até ${ate}). Inativar não cobra a saída: para cobrar, encerre o plano antes.`);
  }
  return linhas;
}
