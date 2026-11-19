import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

import type { CobrancaResponse } from '../api/financeiroTipos';
import type {
  ItemDaRenegociacao, PreviaDaRenegociacao, PreviaDaRenegociacaoRequest, RenegociacaoResponse,
} from '../api/financeiroRenegociar';
import { dataNaFaixa, mensagemDaFaixa } from './datasValidas';
import { hojeEmBrasilia, LIMITES, VALOR_MAXIMO_CENTAVOS } from './financeiro';
import { centavosDaTela, dataDaTela } from './formatos';
import { ehCobradaPelaKiwify } from './kiwify';

/**
 * Renegociar cobranças (D14, contrato em `api/financeiroRenegociar.ts`): quais da seleção entram (e por que as outras não),
 * a validação das condições, os textos e a tradução dos erros. Nada aqui soma, divide nem conta datas: total, parcelas,
 * sobra de centavos e vencimentos vêm da prévia do servidor, e a tela só os desenha.
 */

export const LIMITES_DA_RENEGOCIACAO = { cobrancas: 100, parcelas: 12, motivo: LIMITES.motivo, ajusteCentavos: VALOR_MAXIMO_CENTAVOS } as const;

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;
export const quantasCobrancas = (n: number): string => plural(n, 'cobrança', 'cobranças');
export const quantasParcelas = (n: number): string => plural(n, 'parcela', 'parcelas');

// ---- Quais cobranças da seleção entram ----

type Cobranca = Pick<CobrancaResponse, 'id' | 'situacao' | 'tipo' | 'alunoId' | 'alunoNome' | 'versao' | 'cobrancaAutomatica'>;

/** Por que uma cobrança não entra; `null` = entra. A API confere de novo (409 `COBRANCA_NAO_ABERTA`/`COBRANCA_NAO_RENEGOCIAVEL`). */
export function motivoDeFicarDeFora(c: Pick<CobrancaResponse, 'situacao' | 'tipo'>): string | null {
  if (c.situacao !== 'ABERTA') return 'Não está em aberto.';
  if (c.tipo === 'SAIDA') return 'Cobrança de saída não entra em renegociação.';
  if (c.tipo === 'RENEGOCIACAO') return 'Já é parcela de um acordo. Para mudar, desfaça o acordo antes.';
  return null;
}

/** "Renegociar" na folha de uma cobrança: só em aberto (vencida incluída), mensalidade ou avulsa. */
export const podeRenegociar = (c: Pick<CobrancaResponse, 'situacao' | 'tipo'>): boolean => motivoDeFicarDeFora(c) === null;

/** D3 (18/11): a mensalidade com cobrança automática da Kiwify não se renegocia; a API recusa com o mesmo texto (409 `RENEGOCIACAO_COBRANCA_AUTOMATICA`). */
export const MOTIVO_RENEGOCIACAO_AUTOMATICA = 'Esta cobrança é cobrada automaticamente pela Kiwify e não pode ser renegociada.';

/**
 * Por que "Renegociar" aparece desabilitado: a cobrança entraria (em aberto, mensalidade ou avulsa), mas é cobrada pela Kiwify.
 * `null` = habilitado, ou a ação nem aparece (`podeRenegociar` falso).
 */
export const motivoDeRenegociarDesabilitado = (c: Pick<CobrancaResponse, 'situacao' | 'tipo' | 'cobrancaAutomatica'>): string | null =>
  podeRenegociar(c) && ehCobradaPelaKiwify(c) ? MOTIVO_RENEGOCIACAO_AUTOMATICA : null;

export const MOTIVO_ALUNOS_DIFERENTES = 'As cobranças são de alunos diferentes. Renegocie um aluno por vez: filtre pelo aluno e marque só as dele.';

/**
 * Antes de abrir a renegociação: as que entrariam são de mais de um aluno. O "Mais ações" apaga o item com este motivo no lugar da
 * explicação (como no caso da Kiwify), em vez de abrir a folha só para dar a notícia. A folha confere de novo (`separarParaRenegociar`).
 */
export const motivoDeLoteComAlunosDiferentes = (lote: readonly Cobranca[]): string | null =>
  new Set(separarParaRenegociar(lote).entram.map((c) => c.alunoId)).size > 1 ? MOTIVO_ALUNOS_DIFERENTES : null;

/** O mesmo para um lote: alguma que entraria é automática, então o lote todo não segue (a API recusa o pedido inteiro). */
export const motivoDeRenegociarOLoteDesabilitado = (lote: readonly Pick<CobrancaResponse, 'situacao' | 'tipo' | 'cobrancaAutomatica'>[]): string | null =>
  lote.some((c) => motivoDeRenegociarDesabilitado(c) !== null) ? MOTIVO_RENEGOCIACAO_AUTOMATICA : null;

/** "Desfazer acordo": na original renegociada e na parcela do acordo ainda em aberto. A API confere se alguma foi paga. */
export const podeDesfazerAcordo = (c: Pick<CobrancaResponse, 'situacao' | 'tipo' | 'acordoId'>): boolean =>
  !!c.acordoId && (c.situacao === 'RENEGOCIADA' || (c.tipo === 'RENEGOCIACAO' && c.situacao === 'ABERTA'));

export interface SeparacaoDaRenegociacao<C extends Cobranca> {
  /** As que vão para o acordo, na ordem da seleção. */
  entram: C[];
  /** As que ficam de fora, com o motivo. */
  ficam: { cobranca: C; motivo: string }[];
  /** O nome do aluno das que entram (nulo com alunos diferentes ou sem nenhuma). */
  alunoNome: string | null;
  /** Por que não dá para seguir (o "Continuar" fica desabilitado com ele), ou `null`. */
  problema: string | null;
}

/**
 * Separa a seleção: entram as ABERTAS (vencidas incluídas) de mensalidade e avulsa; as outras ficam de fora com o motivo.
 * As que entram têm de ser do mesmo aluno (com dois alunos a tela não escolhe por ninguém: pede um aluno por vez) e ser de
 * 1 a 100.
 */
export function separarParaRenegociar<C extends Cobranca>(selecao: readonly C[]): SeparacaoDaRenegociacao<C> {
  const entram: C[] = [];
  const ficam: { cobranca: C; motivo: string }[] = [];
  for (const c of selecao) {
    const motivo = motivoDeFicarDeFora(c);
    if (motivo) ficam.push({ cobranca: c, motivo });
    else entram.push(c);
  }
  const alunos = new Set(entram.map((c) => c.alunoId));
  let problema: string | null = null;
  if (entram.length === 0) {
    problema = selecao.length === 1 ? 'Esta cobrança não pode ser renegociada.' : 'Nenhuma das cobranças selecionadas pode ser renegociada.';
  } else if (motivoDeRenegociarOLoteDesabilitado(entram)) {
    // Uma automática barra o acordo inteiro (a API recusa o pedido todo): nada de oferecer o resto.
    problema = MOTIVO_RENEGOCIACAO_AUTOMATICA;
  } else if (alunos.size > 1) {
    problema = MOTIVO_ALUNOS_DIFERENTES;
  } else if (entram.length > LIMITES_DA_RENEGOCIACAO.cobrancas) {
    problema = `O limite é de ${LIMITES_DA_RENEGOCIACAO.cobrancas} cobranças por acordo. Tire ${quantasCobrancas(entram.length - LIMITES_DA_RENEGOCIACAO.cobrancas)} da seleção.`;
  }
  return { entram, ficam, alunoNome: alunos.size === 1 ? entram[0].alunoNome ?? null : null, problema };
}

// ---- Condições ----

export type CampoDaRenegociacao = 'cobrancas' | 'acrescimo' | 'desconto' | 'parcelas' | 'primeiroVencimento' | 'motivo';
export type ErrosDaRenegociacao = Partial<Record<CampoDaRenegociacao, string>>;

/** O que os campos mostram, como texto. */
export interface CondicoesDigitadas {
  /** Reais com vírgula ou a máscara ("R$ 50,00"); vazio = sem acréscimo. */
  acrescimoTexto: string;
  descontoTexto: string;
  /** Inteiro de 1 a 12. */
  parcelasTexto: string;
  /** `DD/MM/AAAA`. */
  primeiroVencimentoTexto: string;
  motivo: string;
}

export interface Condicoes {
  acrescimoCentavos: number;
  descontoCentavos: number;
  parcelas: number;
  primeiroVencimento: string;
  motivo: string;
}

/** Vazio ou zero = 0 (sem ajuste); senão os centavos exatos, ou `null` se o texto não é um valor. */
export function lerAjuste(texto: string): number | null {
  const t = texto.trim();
  if (!t || /^(R\$\s*)?0+([.,]0{1,2})?$/i.test(t)) return 0;
  return centavosDaTela(t);
}

function validarAjuste(texto: string, nome: 'acréscimo' | 'desconto'): { centavos: number | null; erro: string | null } {
  const centavos = lerAjuste(texto);
  if (centavos === null) return { centavos: null, erro: `Valor do ${nome} inválido. Use reais, por exemplo 50,00, ou deixe em branco.` };
  if (centavos > LIMITES_DA_RENEGOCIACAO.ajusteCentavos) return { centavos: null, erro: `O ${nome} passa do máximo permitido (R$ 10.000.000,00).` };
  return { centavos, erro: null };
}

export const MENSAGEM_PARCELAS_DA_RENEGOCIACAO = `As parcelas vão de 1 a ${LIMITES_DA_RENEGOCIACAO.parcelas}.`;

/**
 * Confere as condições sem calcular nada: ajustes válidos (vazio = 0), parcelas de 1 a 12, primeiro vencimento na faixa
 * PLANEJAMENTO (a de `datasValidas`, como a avulsa) e motivo obrigatório até 300. Desconto maior que o total é do servidor
 * (seria uma conta): volta como 422 no campo.
 */
export function validarCondicoes(
  entrada: CondicoesDigitadas, hoje: string = hojeEmBrasilia(),
): { ok: true; condicoes: Condicoes } | { ok: false; erros: ErrosDaRenegociacao } {
  const erros: ErrosDaRenegociacao = {};
  const acrescimo = validarAjuste(entrada.acrescimoTexto, 'acréscimo');
  if (acrescimo.erro) erros.acrescimo = acrescimo.erro;
  const desconto = validarAjuste(entrada.descontoTexto, 'desconto');
  if (desconto.erro) erros.desconto = desconto.erro;

  const p = entrada.parcelasTexto.trim();
  const parcelas = /^\d{1,2}$/.test(p) && Number(p) >= 1 && Number(p) <= LIMITES_DA_RENEGOCIACAO.parcelas ? Number(p) : null;
  if (parcelas === null) erros.parcelas = MENSAGEM_PARCELAS_DA_RENEGOCIACAO;

  const texto = entrada.primeiroVencimentoTexto.trim();
  const iso = texto ? dataDaTela(texto) : null;
  let vencimento: string | null = null;
  if (!texto || iso === null) erros.primeiroVencimento = 'Informe o primeiro vencimento.';
  else if (iso === undefined) erros.primeiroVencimento = texto.length === 10 ? 'Data inválida.' : 'Informe a data completa, como 05/12/2026.';
  else if (!dataNaFaixa(iso, 'PLANEJAMENTO', hoje)) erros.primeiroVencimento = mensagemDaFaixa('Primeiro vencimento', 'PLANEJAMENTO', hoje);
  else vencimento = iso;

  const motivo = entrada.motivo.trim();
  if (!motivo) erros.motivo = 'Explique o motivo da renegociação. Só a equipe vê.';
  else if (motivo.length > LIMITES_DA_RENEGOCIACAO.motivo) erros.motivo = `O motivo pode ter até ${LIMITES_DA_RENEGOCIACAO.motivo} caracteres.`;

  if (Object.keys(erros).length > 0 || acrescimo.centavos === null || desconto.centavos === null || parcelas === null || vencimento === null) {
    return { ok: false, erros };
  }
  return { ok: true, condicoes: { acrescimoCentavos: acrescimo.centavos, descontoCentavos: desconto.centavos, parcelas, primeiroVencimento: vencimento, motivo } };
}

/** O corpo da prévia: as originais com a versão vista e as condições (o motivo não vai: a prévia não o usa). */
export function corpoDaPrevia(cobrancas: readonly Pick<CobrancaResponse, 'id' | 'versao'>[], c: Condicoes): PreviaDaRenegociacaoRequest {
  const itens: ItemDaRenegociacao[] = cobrancas.map((x) => ({ cobrancaId: x.id, versao: x.versao }));
  return { itens, acrescimoCentavos: c.acrescimoCentavos, descontoCentavos: c.descontoCentavos, parcelas: c.parcelas, primeiroVencimento: c.primeiroVencimento };
}

/** Duas prévias são da mesma conta? (A resposta que chega depois de a pessoa mudar algo é descartada.) */
export const mesmaPrevia = (a: PreviaDaRenegociacaoRequest | null, b: PreviaDaRenegociacaoRequest | null): boolean =>
  !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

// ---- Textos ----

/** "Renegociar cobrança" (uma: recálculo) ou "Renegociar 3 cobranças" (várias: acordo). */
export const tituloDaRenegociacao = (n: number): string => (n === 1 ? 'Renegociar cobrança' : `Renegociar ${quantasCobrancas(n)}`);

/** O botão que confirma diz o resultado: "Renegociar 3 cobranças em 4 parcelas". */
export const rotuloDoConfirmar = (previa: Pick<PreviaDaRenegociacao, 'quantidadeDeOriginais' | 'parcelas'>): string =>
  `Renegociar ${quantasCobrancas(previa.quantidadeDeOriginais)} em ${quantasParcelas(previa.parcelas.length)}`;

/** O que acontece ao confirmar, em frases curtas (a prévia mostra os números). */
export function oQueAcontece(previa: Pick<PreviaDaRenegociacao, 'quantidadeDeOriginais' | 'parcelas'>): string[] {
  const n = previa.quantidadeDeOriginais;
  const k = previa.parcelas.length;
  return [
    `${n === 1 ? 'A cobrança original passa' : `As ${n} cobranças originais passam`} a “Renegociada”: ${n === 1 ? 'sai' : 'saem'} dos totais, do vencido e dos lembretes, e o aluno não tem mais o “Pagar” ${n === 1 ? 'dela' : 'delas'}. Nada é apagado.`,
    `${k === 1 ? 'Nasce 1 cobrança nova' : `Nascem ${k} cobranças novas`} em aberto, com o selo “Acordo”. O aluno ${k === 1 ? 'a vê' : 'as vê'} no app, como as outras.`,
    'Dá para desfazer o acordo enquanto nenhuma parcela for paga, contestada ou estornada.',
  ];
}

/** O aviso depois do 201 (ou 200 da repetição): "3 cobranças renegociadas em 4 parcelas." */
export function textoDaRenegociacaoFeita(r: Pick<RenegociacaoResponse, 'renegociadas' | 'parcelas'>): string {
  return `${plural(r.renegociadas, 'cobrança renegociada', 'cobranças renegociadas')} em ${quantasParcelas(r.parcelas)}.`;
}

// ---- Erros ----

export const MENSAGEM_CAMPOS_DA_RENEGOCIACAO = 'Confira os campos destacados.';
/** Sem retorno do confirmar não dá para saber se gravou; repetir é seguro: o mesmo `pedidoId` não renegocia em dobro. */
export const MENSAGEM_REPETIR_SEM_DOBRAR = 'Não foi possível confirmar se a renegociação foi feita. Tente de novo: repetir não renegocia em dobro.';
const LISTA_MUDOU = 'Nada foi renegociado. A lista foi atualizada: feche e selecione de novo.';

/** 404 e 409 que dizem que as cobranças da folha não valem mais: a folha só deixa fechar, e a lista de trás recarrega. */
const BLOQUEIOS: Readonly<Record<string, string>> = {
  COBRANCA_NAO_ENCONTRADA: `Alguma cobrança não foi encontrada. ${LISTA_MUDOU}`,
  NAO_ENCONTRADO: `Alguma cobrança não foi encontrada. ${LISTA_MUDOU}`,
  CONFLITO_EDICAO: `Alguma cobrança foi alterada em outro lugar enquanto você renegociava. ${LISTA_MUDOU}`,
  COBRANCA_NAO_ABERTA: `Alguma cobrança não está mais em aberto (paga, cancelada ou renegociada em outro lugar). ${LISTA_MUDOU}`,
  COBRANCAS_DE_ALUNOS_DIFERENTES: 'As cobranças são de alunos diferentes. Nada foi renegociado. Renegocie um aluno por vez.',
  COBRANCA_NAO_RENEGOCIAVEL: 'Cobrança de saída e parcela de acordo não entram em renegociação. Nada foi renegociado.',
  ALUNO_INATIVO: 'O aluno está inativo. Nada foi renegociado. Reative-o para renegociar as cobranças dele.',
  ALUNO_ANONIMIZADO: 'O aluno foi anonimizado e não recebe cobrança. Nada foi renegociado.',
};

const CAMPOS_DA_API: Readonly<Record<string, CampoDaRenegociacao>> = {
  acrescimoCentavos: 'acrescimo',
  descontoCentavos: 'desconto',
  parcelas: 'parcelas',
  primeiroVencimento: 'primeiroVencimento',
  motivo: 'motivo',
};

export interface ErroDaRenegociacao {
  mensagem: string;
  /** Erros por campo (422); a tela volta às condições com eles. */
  campos: ErrosDaRenegociacao;
  /** As cobranças da folha não valem mais (404/409): só "Fechar", e quem chamou recarrega a lista. */
  bloqueia: boolean;
}

function statusDoErro(erro: unknown): number | null {
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  return typeof status === 'number' ? status : null;
}

/**
 * Tradução do erro da prévia e do confirmar: 422 `RENEGOCIACAO_INVALIDA` por campo (`itens` e `itens[i]` viram o campo
 * `cobrancas`; o que a tela não mostra vai ao texto geral); 404 e os 409 de dado velho bloqueiam a folha; 403 e 503 dizem o
 * texto da API; sem conexão e erro desconhecido: na prévia, tentar de novo; no confirmar, repetir com o mesmo pedido.
 */
export function traduzirErroDaRenegociacao(erro: unknown, fase: 'previa' | 'confirmar'): ErroDaRenegociacao {
  const base: ErroDaRenegociacao = { mensagem: '', campos: {}, bloqueia: false };
  const codigo = codigoApi(erro);
  const status = statusDoErro(erro);
  if (codigo === 'RENEGOCIACAO_INVALIDA') {
    const campos: ErrosDaRenegociacao = {};
    const fora: string[] = [];
    for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
      const nosso = campo.startsWith('itens') ? 'cobrancas' : CAMPOS_DA_API[campo];
      if (nosso) campos[nosso] ??= mensagem;
      else fora.push(mensagem);
    }
    const mensagem = fora.length > 0 ? fora.join(' ') : Object.keys(campos).length > 0 ? MENSAGEM_CAMPOS_DA_RENEGOCIACAO : mensagemApi(erro, MENSAGEM_CAMPOS_DA_RENEGOCIACAO);
    return { ...base, mensagem, campos };
  }
  // Automática: o texto é o da API (sem "a lista foi atualizada": a tela só deixa fechar e recarrega a lista, que passa a marcar a cobrança).
  if (codigo === 'RENEGOCIACAO_COBRANCA_AUTOMATICA') return { ...base, mensagem: mensagemApi(erro, MOTIVO_RENEGOCIACAO_AUTOMATICA), bloqueia: true };
  const bloqueio = codigo ? BLOQUEIOS[codigo] : undefined;
  if (bloqueio) return { ...base, mensagem: bloqueio, bloqueia: true };
  if (status === 404) return { ...base, mensagem: BLOQUEIOS.COBRANCA_NAO_ENCONTRADA, bloqueia: true };
  const nada = fase === 'previa' ? 'Não foi possível calcular a prévia agora.' : 'Nada foi renegociado.';
  if (status === 403 || codigo === 'FINANCEIRO_INDISPONIVEL') return { ...base, mensagem: mensagemApi(erro, nada) };
  if (fase === 'previa') {
    return { ...base, mensagem: erroDeConexao(erro) ? 'Sem conexão com o servidor. Confira a internet e tente de novo.' : 'Não foi possível calcular a prévia agora. Tente de novo.' };
  }
  return { ...base, mensagem: erroDeConexao(erro) ? `Sem conexão com o servidor. ${MENSAGEM_REPETIR_SEM_DOBRAR}` : MENSAGEM_REPETIR_SEM_DOBRAR };
}
