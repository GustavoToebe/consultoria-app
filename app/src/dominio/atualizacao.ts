import type { Atualizacao, FaseAtualizacao } from '../api/tipos';
import { dataParaTela, somarDias } from './formatos';

/** Usa dias de calendário, sem arredondamento por hora ou horário de verão. Igual à API. */
export function faseAtualizacao(hoje: string, data: string | null, atrasoAte: string | null, estado?: FaseAtualizacao) {
  if (!data) return { fase: 'NENHUMA' as FaseAtualizacao, diasParaData: 0, diasDeAtraso: 0 };
  const dias = Math.round((Date.parse(atrasoAte ?? data) - Date.parse(hoje)) / 86_400_000);
  const fase: FaseAtualizacao = estado === 'ENVIADA' || estado === 'REVISADA' ? estado
    : dias < 0 ? 'ATRASADA' : dias <= 1 ? 'ABERTA' : dias <= 3 ? 'AVISO' : 'NENHUMA';
  return { fase, diasParaData: dias, diasDeAtraso: Math.max(0, -dias) };
}
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
export const podeResponderAtualizacao = (a: Atualizacao, hoje: string) =>
  !!a.dataAtualizacao && a.fase !== 'ENVIADA' && a.fase !== 'REVISADA' && hoje >= somarDias(a.dataAtualizacao, -1);
