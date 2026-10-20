import type { Atualizacao } from '../api/tipos';
import type { TipoSelo } from '../ui/Selo';
import { dataCurta } from './formatos';

export interface ItemParaFazer {
  titulo: string;
  detalhe: string;
  selo: { texto: string; tipo: TipoSelo } | null;
  /** Abre a resposta (aberta ou atrasada): o item é a ação, e "Vou atrasar" aparece logo abaixo. */
  responder: boolean;
}

/**
 * Atualização no bloco "Para fazer" do início do aluno. O selo é curto e diz de quê ("Até 20/10", "Atrasada 2 dias");
 * a frase vai no detalhe. Antes eram selos longos em caixa alta ("RESPONDA SUA ATUALIZAÇÃO ATÉ 20/10/2026") que
 * quebravam em 360 px e repetiam o título.
 */
export function itemDaAtualizacao(a: Atualizacao): ItemParaFazer {
  const data = a.atrasoAte ?? a.dataAtualizacao;
  const dia = data ? dataCurta(data) : '—';
  if (a.fase === 'REVISADA') {
    return { titulo: 'Seu treinador respondeu', detalhe: 'Toque para ler a resposta da sua atualização.', selo: { texto: 'Resposta nova', tipo: 'sucesso' }, responder: false };
  }
  if (a.fase === 'ENVIADA') {
    return { titulo: 'Sua atualização', detalhe: 'Enviada. Aguardando o treinador.', selo: { texto: 'Enviada', tipo: 'sucesso' }, responder: false };
  }
  if (a.fase === 'ATRASADA') {
    const dias = `${a.diasDeAtraso} ${a.diasDeAtraso === 1 ? 'dia' : 'dias'}`;
    return { titulo: 'Responder a atualização', detalhe: `Era para ${dia}. O rascunho fica salvo neste aparelho.`, selo: { texto: `Atrasada ${dias}`, tipo: 'perigo' }, responder: true };
  }
  if (a.fase === 'ABERTA') {
    const detalhe = a.atrasoAte ? `Você avisou que vai responder até ${dia}.` : 'O rascunho fica salvo neste aparelho.';
    return { titulo: 'Responder a atualização', detalhe, selo: { texto: `Até ${dia}`, tipo: 'atencao' }, responder: true };
  }
  if (a.atrasoAte) {
    return { titulo: 'Sua atualização', detalhe: `Você avisou: nova data ${dia}.`, selo: { texto: `Até ${dia}`, tipo: 'atencao' }, responder: false };
  }
  const quando = a.diasParaData === 1 ? 'amanhã' : `em ${a.diasParaData} dias`;
  return { titulo: 'Sua atualização', detalhe: `Abre ${quando} (${dia}). Toque para ver as perguntas.`, selo: null, responder: false };
}
