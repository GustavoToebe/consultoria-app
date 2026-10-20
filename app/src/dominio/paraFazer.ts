import type { CobrancaDoAluno } from '../api/financeiroTipos';
import type { Atualizacao } from '../api/tipos';
import type { TipoSelo } from '../ui/Selo';
import { pagamentoPendente } from './financeiro';
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
 * uma cobrança: não há botão de pagar (o treinador combina a forma de pagamento). Vencida em âmbar, a vencer em neutro;
 * vermelho continua só da atualização atrasada. Sem pendência, `null`.
 */
export function itemDoPagamento(abertas: readonly CobrancaDoAluno[] | null | undefined, hoje: string): ItemParaFazer | null {
  const pendentes = pagamentoPendente(abertas, hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  if (pendentes.length === 0) return null;
  const primeira = pendentes[0];
  const vencidas = pendentes.filter((c) => c.vencida).length;
  const titulo = 'Pagamento em aberto';
  const valor = centavosParaTela(primeira.valorCentavos);
  const quando = dataCurta(primeira.vencimento);
  const mais = pendentes.length > 1 ? ` (e mais ${pendentes.length - 1})` : '';
  if (vencidas > 0) {
    return { titulo, detalhe: `${valor}${mais}, venceu em ${quando}. Fale com o seu treinador.`, selo: { texto: 'Vencida', tipo: 'atencao' }, responder: false };
  }
  return { titulo, detalhe: `${valor}${mais}, vence em ${quando}.`, selo: { texto: `Vence ${quando}`, tipo: 'neutro' }, responder: false };
}
