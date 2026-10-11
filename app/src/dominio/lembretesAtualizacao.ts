import type { Atualizacao } from '../api/tipos';
import { somarDias } from './formatos';

/** Horário local do aparelho. Não inclui resposta, medida ou nome do aluno. */
export function lembretesDaAtualizacao(a: Atualizacao | null, agora = new Date()) {
  if (!a?.dataAtualizacao || a.fase === 'ENVIADA' || a.fase === 'REVISADA') return [];
  const prazo = a.atrasoAte ?? a.dataAtualizacao;
  return [
    { chave: 'aviso', dia: somarDias(prazo,-3), texto: 'Sua atualização é em 3 dias.' },
    { chave: 'dia', dia: prazo, texto: 'Hoje é dia da sua atualização.' },
    { chave: 'pendente', dia: somarDias(prazo,1), texto: 'Sua atualização está pendente. Se for atrasar, avise pelo app.' },
  ].map(({chave,dia,texto})=>{
    const [ano,mes,data]=dia.split('-').map(Number);
    return {chave,data:new Date(ano,mes-1,data,9,0,0),texto};
  }).filter(l=>l.data.getTime()>agora.getTime());
}
