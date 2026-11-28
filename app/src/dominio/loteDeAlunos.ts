import type { ResultadoLote } from '../api/tipos';
import { CODIGO_CONTRATO_FECHADO_VIGENTE } from './saidaDoPlano';

/** Mesmo teto da API (`AlunoLoteService.LIMITE`). */
export const LIMITE_LOTE = 100;

export type AcaoDoLote = 'responsavel' | 'questionario' | 'desativar';

/**
 * "1 aluno marcado" / "N alunos marcados"; zero vira o convite a marcar. Acima do teto (só com "Marcar todos do filtro")
 * vale só o convite de acesso, que o app divide em chamadas de 100.
 */
export function textoDaSelecao(quantos: number): string {
  if (quantos === 0) return `Nenhum aluno marcado (até ${LIMITE_LOTE} por vez).`;
  if (quantos > LIMITE_LOTE) return `${quantos} alunos marcados (acima de ${LIMITE_LOTE}, só os convites de acesso).`;
  return `${quantos} ${quantos === 1 ? 'aluno marcado' : 'alunos marcados'} (até ${LIMITE_LOTE} por vez).`;
}

/**
 * Mensagem do aviso depois do lote: só contagens, sem nome de aluno. Quem a API recusou (`recusados`, só no desativar: contrato
 * fechado vigente) não conta como "já estava assim" e ganha o porquê.
 */
export function textoDoResultado(acao: AcaoDoLote, r: ResultadoLote): string {
  const alunos = (n: number) => `${n} ${n === 1 ? 'aluno' : 'alunos'}`;
  const recusados = r.recusados ?? [];
  if (r.alterados === 0 && recusados.length === 0) {
    return acao === 'desativar' ? 'Nenhuma mudança: os alunos marcados já estavam inativos.' : 'Nenhuma mudança: os alunos marcados já estavam assim.';
  }
  const feito = acao === 'desativar' ? 'desativado' : 'atualizado';
  const feitos = (n: number) => (n === 1 ? feito : `${feito}s`);
  const partes = [r.alterados > 0 ? `${alunos(r.alterados)} ${feitos(r.alterados)}.` : `Nenhum aluno ${feito}.`];
  const n = recusados.length;
  if (n > 0) {
    const porque = recusados.every((x) => x.codigo === CODIGO_CONTRATO_FECHADO_VIGENTE)
      ? `encerre ${n === 1 ? 'o contrato' : 'os contratos'} antes (com ou sem multa)`
      : recusados[0].mensagem.replace(/\.$/, '');
    partes.push(`${n} não ${n === 1 ? 'foi' : 'foram'} ${feitos(n)}: ${porque}.`);
  }
  const iguais = r.selecionados - r.alterados - n;
  if (iguais > 0) partes.push(`${iguais} já ${iguais === 1 ? 'estava' : 'estavam'} assim.`);
  return partes.join(' ');
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
