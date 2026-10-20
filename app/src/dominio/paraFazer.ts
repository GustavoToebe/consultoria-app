import type { Atualizacao } from '../api/tipos';
import type { TipoSelo } from '../ui/Selo';
import { dataCurta } from './formatos';

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
