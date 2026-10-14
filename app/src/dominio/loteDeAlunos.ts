import type { ResultadoLote } from '../api/tipos';

/** Mesmo teto da API (`AlunoLoteService.LIMITE`). */
export const LIMITE_LOTE = 100;

export type AcaoDoLote = 'responsavel' | 'questionario' | 'desativar';

/** "1 aluno selecionado" / "N alunos selecionados"; zero vira o convite a marcar. */
export function textoDaSelecao(quantos: number): string {
  if (quantos === 0) return `Nenhum aluno marcado (até ${LIMITE_LOTE} por vez).`;
  return `${quantos} ${quantos === 1 ? 'aluno marcado' : 'alunos marcados'} (até ${LIMITE_LOTE} por vez).`;
}

/** Mensagem do aviso depois do lote: só contagens, sem nome de aluno. */
export function textoDoResultado(acao: AcaoDoLote, r: ResultadoLote): string {
  const alunos = (n: number) => `${n} ${n === 1 ? 'aluno' : 'alunos'}`;
  if (r.alterados === 0) {
    return acao === 'desativar' ? 'Nenhuma mudança: os alunos marcados já estavam inativos.' : 'Nenhuma mudança: os alunos marcados já estavam assim.';
  }
  const feito = acao === 'desativar' ? 'desativado' : 'atualizado';
  const base = `${alunos(r.alterados)} ${r.alterados === 1 ? feito : feito.replace(/o$/, 'os')}.`;
  const iguais = r.selecionados - r.alterados;
  return iguais > 0 ? `${base} ${iguais} já ${iguais === 1 ? 'estava' : 'estavam'} assim.` : base;
}

/** O que a confirmação de cada ação explica antes de aplicar. */
export function mensagemDaConfirmacao(acao: AcaoDoLote, quantos: number): string {
  const alunos = `${quantos} ${quantos === 1 ? 'aluno' : 'alunos'}`;
  switch (acao) {
    case 'responsavel': return `O responsável de ${alunos} passa a ser o escolhido.`;
    case 'questionario': return `${alunos} passa${quantos === 1 ? '' : 'm'} a usar o questionário de atualização escolhido.`;
    case 'desativar': return `${alunos} ${quantos === 1 ? 'será desativado' : 'serão desativados'} e ${quantos === 1 ? 'perde' : 'perdem'} o acesso; as sessões abertas ${quantos === 1 ? 'dele são encerradas' : 'deles são encerradas'}. Dá para reativar um por um na ficha.`;
  }
}
