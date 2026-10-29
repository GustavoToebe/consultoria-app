import type { AvisoDeCompromisso, TipoAvisoCompromisso } from '../api/agendaTipos';
import type { CobrancaDoAluno } from '../api/financeiroTipos';
import type { Atualizacao } from '../api/tipos';
import type { TipoSelo } from '../ui/Selo';
import { dataEmBrasilia, horaEmBrasilia } from './agendaPresencial';
import { dataSemAnoCorrente } from './datasRelativas';
import { informacaoDaCobranca, pagamentoPendente, type ComoPagar } from './financeiro';
import { centavosParaTela, dataCurta } from './formatos';

export interface ItemParaFazer {
  titulo: string;
  /** Uma linha de contexto sob o título. */
  detalhe: string;
  selo: { texto: string; tipo: TipoSelo } | null;
  /** Abre a resposta (aberta ou atrasada): o item é a ação, e "Vou atrasar" aparece logo abaixo. */
  responder: boolean;
}

/** Anamnese pendente em "Suas pendências": o selo "Pendente" é neutro (vermelho é só para atrasada). */
export const ITEM_ANAMNESE: ItemParaFazer = {
  titulo: 'Anamnese inicial',
  detalhe: 'Seu treinador pediu algumas informações.',
  selo: { texto: 'Pendente', tipo: 'neutro' },
  responder: true,
};

/**
 * Atualização em "Suas pendências" do início do aluno. O título é sempre o mesmo ("Atualização do período"); o selo é
 * curto e diz de quê ("Até 20/10", "Atrasada 2 dias") e a frase vai no detalhe. Vermelho só para atrasada, verde para
 * enviada/resposta nova e neutro para o resto (âmbar e vermelho juntos na mesma lista faziam tudo parecer urgente).
 */
export function itemDaAtualizacao(a: Atualizacao): ItemParaFazer {
  const titulo = 'Atualização do período';
  const data = a.atrasoAte ?? a.dataAtualizacao;
  const dia = data ? dataCurta(data) : '—';
  if (a.fase === 'REVISADA') {
    return { titulo, detalhe: 'Seu treinador respondeu. Toque para ler.', selo: { texto: 'Resposta nova', tipo: 'sucesso' }, responder: false };
  }
  if (a.fase === 'ENVIADA') {
    return { titulo, detalhe: 'Enviada. Aguardando o treinador.', selo: { texto: 'Enviada', tipo: 'sucesso' }, responder: false };
  }
  if (a.fase === 'ATRASADA') {
    const dias = `${a.diasDeAtraso} ${a.diasDeAtraso === 1 ? 'dia' : 'dias'}`;
    return { titulo, detalhe: `Era para ${dia}. O rascunho fica salvo neste aparelho.`, selo: { texto: `Atrasada ${dias}`, tipo: 'perigo' }, responder: true };
  }
  if (a.fase === 'ABERTA') {
    const detalhe = a.atrasoAte ? `Você avisou que vai responder até ${dia}.` : 'Questionário disponível. O rascunho fica salvo neste aparelho.';
    return { titulo, detalhe, selo: { texto: `Até ${dia}`, tipo: 'neutro' }, responder: true };
  }
  if (a.atrasoAte) {
    return { titulo, detalhe: `Você avisou: nova data ${dia}.`, selo: { texto: `Até ${dia}`, tipo: 'neutro' }, responder: false };
  }
  const quando = a.diasParaData === 1 ? 'amanhã' : `em ${a.diasParaData} dias`;
  return { titulo, detalhe: `Abre ${quando} (${dia}). Toque para ver as perguntas.`, selo: null, responder: false };
}

/**
 * "Pagamento em aberto" em "Suas pendências": cobrança vencida (a API decide) ou que vence em até 3 dias. É um aviso, não
 * uma cobrança: não há botão de pagar aqui (o item leva à Conta, onde fica o "Pagar", se a plataforma o tem). Vencida em
 * âmbar, a vencer em neutro; vermelho continua só da atualização atrasada. No celular sem o "Pagar" (`modo` `informar`) o
 * detalhe só informa, no formato de `informacaoDaCobranca`, sem frase de chamada. Sem pendência, `null`.
 */
export function itemDoPagamento(
  abertas: readonly CobrancaDoAluno[] | null | undefined,
  hoje: string,
  modo: ComoPagar = 'botao',
): ItemParaFazer | null {
  const pendentes = pagamentoPendente(abertas, hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  if (pendentes.length === 0) return null;
  const primeira = pendentes[0];
  const vencidas = pendentes.filter((c) => c.vencida).length;
  const titulo = 'Pagamento em aberto';
  const valor = centavosParaTela(primeira.valorCentavos);
  const quando = dataCurta(primeira.vencimento);
  const mais = pendentes.length > 1 ? ` (e mais ${pendentes.length - 1})` : '';
  const informacao = modo === 'informar' ? informacaoDaCobranca(primeira) : null;
  if (informacao) {
    return {
      titulo, detalhe: `${informacao}${mais}`,
      selo: primeira.vencida ? { texto: 'Vencida', tipo: 'atencao' } : { texto: `Vence ${quando}`, tipo: 'neutro' }, responder: false,
    };
  }
  if (vencidas > 0) {
    return { titulo, detalhe: `${valor}${mais}, venceu em ${quando}. Fale com o seu treinador.`, selo: { texto: 'Vencida', tipo: 'atencao' }, responder: false };
  }
  return { titulo, detalhe: `${valor}${mais}, vence em ${quando}.`, selo: { texto: `Vence ${quando}`, tipo: 'neutro' }, responder: false };
}

// ---- Avisos de compromisso (D12) ----

/** Quantos avisos aparecem de uma vez em "Suas pendências"; a API devolve até 20 (os mais novos primeiro). */
export const AVISOS_VISIVEIS = 5;

/** Item de aviso: `id` é o do aviso, para marcar como visto ao tocar. */
export interface ItemDoAviso extends ItemParaFazer {
  id: string;
  tipo: TipoAvisoCompromisso;
}

const SELO_DO_AVISO: Record<TipoAvisoCompromisso, string> = { NOVO: 'Novo', REMARCADO: 'Remarcado', CANCELADO: 'Cancelado' };

/**
 * A frase do aviso (D12), com data e hora de Brasília do `inicio` copiado no momento do aviso e o ano só quando não é o
 * corrente: "Novo compromisso: 05/11 às 09:00 com Ana", "Compromisso remarcado: agora 05/11 às 09:00 com Ana",
 * "Compromisso cancelado: 05/11 às 09:00 com Ana". Sem responsável, "com a equipe". `hoje` é a data de Brasília.
 */
export function textoDoAviso(a: Pick<AvisoDeCompromisso, 'tipo' | 'inicio' | 'responsavelNome'>, hoje: string): string {
  const quando = `${dataSemAnoCorrente(dataEmBrasilia(a.inicio), hoje)} às ${horaEmBrasilia(a.inicio)}`;
  const quem = `com ${a.responsavelNome?.trim() || 'a equipe'}`;
  if (a.tipo === 'REMARCADO') return `Compromisso remarcado: agora ${quando} ${quem}`;
  return `${a.tipo === 'CANCELADO' ? 'Compromisso cancelado' : 'Novo compromisso'}: ${quando} ${quem}`;
}

/**
 * Aviso de compromisso em "Suas pendências": a frase da D12 no título, selo neutro com o tipo (vermelho continua só da
 * atualização atrasada). Só avisa: sem botão de confirmar presença; tocar marca como visto e leva ao cartão "Seus
 * compromissos" do mesmo Início.
 */
export function itemDoAviso(a: AvisoDeCompromisso, hoje: string): ItemDoAviso {
  return {
    id: a.id, tipo: a.tipo, titulo: textoDoAviso(a, hoje), detalhe: 'Toque para ver seus compromissos.',
    selo: { texto: SELO_DO_AVISO[a.tipo] ?? 'Aviso', tipo: 'neutro' }, responder: false,
  };
}

/**
 * Os avisos da lista da API (não vistos, mais novos primeiro: a ordem da API se mantém) como itens, sem repetir `id` e sem
 * aviso de data inválida; no máximo {@link AVISOS_VISIVEIS} aparecem e `ocultos` conta os que ficam para depois (cada um
 * some quando o aluno vê o anterior). `total` (com os ocultos) é o que o ponto da aba Início e a contagem das pendências
 * usam.
 */
export function avisosDoInicio(avisos: readonly AvisoDeCompromisso[] | null | undefined, hoje: string):
  { itens: ItemDoAviso[]; ocultos: number; total: number } {
  const vistos = new Set<string>();
  const validos: AvisoDeCompromisso[] = [];
  for (const a of avisos ?? []) {
    if (vistos.has(a.id) || Number.isNaN(Date.parse(a.inicio))) continue;
    vistos.add(a.id);
    validos.push(a);
  }
  const itens = validos.slice(0, AVISOS_VISIVEIS).map((a) => itemDoAviso(a, hoje));
  return { itens, ocultos: validos.length - itens.length, total: validos.length };
}

/** Há aviso de compromisso não visto (o ponto na aba Início). */
export const temAvisoDeCompromisso = (avisos: readonly AvisoDeCompromisso[] | null | undefined): boolean =>
  !!avisos?.some((a) => !Number.isNaN(Date.parse(a.inicio)));
