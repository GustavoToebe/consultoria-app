import type { Atualizacao, AtualizacaoDaLista, FaseAtualizacao } from '../api/tipos';
import { dataParaTela, somarDias } from './formatos';

export const DIAS_MAXIMOS_DE_ATRASO = 15;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
export const prazoAtualizacao = (data: string, atrasoAte: string | null) => atrasoAte && atrasoAte > data ? atrasoAte : data;

/**
 * Usa dias de calendário, sem arredondamento por hora ou horário de verão. Igual à API (RegrasAtualizacao):
 * o formulário abre pela data original; o aviso de atraso só adia o "atrasada" até max(data, atrasoAte).
 */
export function faseAtualizacao(hoje: string, data: string | null, atrasoAte: string | null, estado?: FaseAtualizacao) {
  if (!data) return { fase: 'NENHUMA' as FaseAtualizacao, diasParaData: 0, diasDeAtraso: 0 };
  const diasParaData = diasEntre(hoje, data);
  const diasParaPrazo = diasEntre(hoje, prazoAtualizacao(data, atrasoAte));
  const fase: FaseAtualizacao = estado === 'ENVIADA' || estado === 'REVISADA' ? estado
    : diasParaPrazo < 0 ? 'ATRASADA' : diasParaData <= 1 ? 'ABERTA' : diasParaData <= 3 ? 'AVISO' : 'NENHUMA';
  return { fase, diasParaData: diasParaPrazo, diasDeAtraso: Math.max(0, -diasParaPrazo) };
}
export function limitesNovaDataAtraso(hoje: string, data: string) {
  return { minimo: hoje > data ? hoje : data, maximo: somarDias(data, DIAS_MAXIMOS_DE_ATRASO) };
}
export function novaDataAtrasoValida(hoje: string, data: string, nova: string) {
  const { minimo, maximo } = limitesNovaDataAtraso(hoje, data);
  return nova >= minimo && nova <= maximo;
}
/** Atualização antiga aberta pelo histórico (`?id=`) só se lê: enviar ou avisar atraso vale só para a atual. */
export const formularioSomenteLeitura = (idPedido: string | undefined, idAtual: string | null | undefined) =>
  !!idPedido && idPedido !== idAtual;
/** Link do cartão quando ainda não dá para responder (antes da véspera, com ou sem atraso avisado). */
export const linkCartaoAtualizacao = (a: Atualizacao) =>
  a.fase === 'AVISO' || a.fase === 'NENHUMA' ? 'Ver o que vou responder' : a.feedback ? 'Ler' : 'Ver respostas';
/** Com o aviso de atraso dado, o cartão segue na tela inicial até o envio. */
export const mostrarCartaoAtualizacao = (a: Atualizacao) =>
  a.fase === 'REVISADA' ? !!a.feedback?.naoLido : a.fase !== 'NENHUMA' || !!a.atrasoAte;
export function statusAtualizacao(a: Atualizacao) {
  const data = dataParaTela(a.atrasoAte ?? a.dataAtualizacao);
  if (a.fase === 'REVISADA') return { texto: a.feedback?.naoLido ? 'Seu treinador respondeu sua atualização' : 'Revisada', tipo: 'sucesso' as const };
  if (a.fase === 'ENVIADA') return { texto: 'Enviada. Aguardando o treinador', tipo: 'sucesso' as const };
  if (a.fase === 'ATRASADA') return { texto: `Atualização atrasada há ${a.diasDeAtraso} ${a.diasDeAtraso === 1 ? 'dia' : 'dias'}`, tipo: 'perigo' as const };
  if (a.atrasoAte) return { texto: `Você avisou: nova data ${data}`, tipo: 'atencao' as const };
  if (a.fase === 'ABERTA') return { texto: `Responda sua atualização até ${data}`, tipo: 'atencao' as const };
  return { texto: `Sua atualização é em ${a.diasParaData} dias (${data})`, tipo: 'neutro' as const };
}
export const temAcaoAtualizacao = (a: Atualizacao) => a.fase === 'ABERTA' || a.fase === 'ATRASADA' || !!a.feedback?.naoLido;
/** Atualização de uma pasta: a vigente (pode ainda não ter linha gravada) ou a do histórico; null se nunca houve. */
export function atualizacaoDaPasta(pastaId: string, atual: Atualizacao | null | undefined, historico: readonly Atualizacao[]) {
  if (atual?.pastaId === pastaId) return atual;
  return historico.find(a => a.pastaId === pastaId) ?? null;
}
export const caminhoAtualizacaoTreinador = (a: Pick<Atualizacao,'id'|'alunoId'>) => a.id
  ? `/treinador/atualizacoes/${a.id}` : `/treinador/atualizacoes/previa?alunoId=${a.alunoId}`;
/** Lista aberta a partir de um contador do Início: leva junto o escopo "Meus alunos", para o total bater com a lista. */
export const caminhoListaAtualizacoes = (situacao: string, meus: boolean) =>
  `/treinador/atualizacoes?situacao=${situacao}${meus ? '&meus=true' : ''}`;
export function statusAtualizacaoTreinador(a:AtualizacaoDaLista) {
  if(a.fase==='ENVIADA')return {texto:'Para revisar',tipo:'atencao' as const};
  if(a.fase==='REVISADA')return {texto:'Revisada',tipo:'sucesso' as const};
  if(a.fase==='ATRASADA')return {texto:`Atrasada há ${a.diasDeAtraso} ${a.diasDeAtraso===1?'dia':'dias'}`,tipo:'perigo' as const};
  if(a.atrasoAte)return {texto:`Avisou: nova data ${dataParaTela(a.atrasoAte)}`,tipo:'atencao' as const};
  return {texto:a.fase==='ABERTA'?'Aguardando envio':`Em ${a.diasParaData} dias`,tipo:'neutro' as const};
}
export const podeResponderAtualizacao = (a: Atualizacao, hoje: string) =>
  !!a.dataAtualizacao && a.fase !== 'ENVIADA' && a.fase !== 'REVISADA' && hoje >= somarDias(a.dataAtualizacao, -1);
