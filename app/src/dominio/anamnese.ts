import type { AnamneseDetalhe, AnamneseResumo, SituacaoAnamnese } from '../api/tipos';
import type { RascunhoAtualizacao } from '../offline/repositorioLocal';
import { dataParaTela } from './formatos';

/**
 * Regras de apresentação da anamnese (a decisão é sempre da API). Cor com significado: âmbar = falta alguém agir
 * (aluno responder, treinador revisar), verde = revisada, cinza = dispensada.
 */
export function seloDaAnamnese(situacao: SituacaoAnamnese, paraAluno = false): { texto: string; tipo: 'sucesso' | 'atencao' | 'neutro' } {
  switch (situacao) {
    case 'PENDENTE': return { texto: paraAluno ? 'Para responder' : 'Aguardando o aluno', tipo: 'atencao' };
    case 'ENVIADA': return paraAluno ? { texto: 'Enviada', tipo: 'sucesso' } : { texto: 'Para revisar', tipo: 'atencao' };
    case 'REVISADA': return { texto: 'Revisada', tipo: 'sucesso' };
    case 'DISPENSADA': return { texto: 'Dispensada', tipo: 'neutro' };
  }
}

/** Só uma pendente por aluno: com uma aberta, "Enviar anamnese" espera a resposta ou a dispensa. */
export const temPendente = (lista: readonly Pick<AnamneseResumo, 'situacao'>[]) => lista.some((a) => a.situacao === 'PENDENTE');

/** Linha de datas da lista na ficha: o último marco que aconteceu. */
export function linhaDaAnamnese(a: Pick<AnamneseResumo, 'situacao' | 'atribuidaEm' | 'enviadaEm' | 'revisadaEm' | 'dispensadaEm'>): string {
  const dia = (iso: string | null) => dataParaTela(iso ? iso.slice(0, 10) : null) || '—';
  switch (a.situacao) {
    case 'PENDENTE': return `Enviada ao aluno em ${dia(a.atribuidaEm)}`;
    case 'ENVIADA': return `Respondida em ${dia(a.enviadaEm)}`;
    case 'REVISADA': return `Respondida em ${dia(a.enviadaEm)} · revisada em ${dia(a.revisadaEm)}`;
    case 'DISPENSADA': return `Dispensada em ${dia(a.dispensadaEm)}`;
  }
}

/** O cartão do início do aluno só aparece com anamnese para responder. */
export const mostrarCartaoAnamnese = (a: Pick<AnamneseDetalhe, 'situacao'> | null | undefined) => a?.situacao === 'PENDENTE';

/**
 * Respostas com que o formulário abre: as do rascunho do aparelho, se forem da mesma versão (a da atribuição, que não
 * muda); senão, nada. Já enviada: as enviadas.
 */
export function respostasIniciais(anamnese: Pick<AnamneseDetalhe, 'situacao' | 'questionarioVersaoId' | 'respostas'>, rascunho: RascunhoAtualizacao | null) {
  if (anamnese.situacao !== 'PENDENTE') return { respostas: anamnese.respostas ?? {}, locais: {} as Record<string, string[]> };
  if (!rascunho || rascunho.questionarioVersaoId !== anamnese.questionarioVersaoId) return { respostas: {}, locais: {} as Record<string, string[]> };
  return { respostas: rascunho.respostas, locais: rascunho.fotosLocais ?? {} };
}
