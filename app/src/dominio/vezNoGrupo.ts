import type { ExercicioPlano } from '../api/tipos';
import type { PosicaoNoGrupo } from './combinacoes';

/**
 * Para onde o aluno vai dentro do bi-set, supersérie ou circuito: o próximo do grupo, na ordem e dando a volta, que
 * ainda tem série por fazer. Nulo quando o grupo acabou (ou o exercício está sozinho): aí vale o próximo da sessão.
 * A faixa dizia "volte para X e repita" sem botão; agora a tela oferece "Ir para X".
 */
export function vezNoGrupo(p: PosicaoNoGrupo | null, temPendente: (e: ExercicioPlano) => boolean): ExercicioPlano | null {
  if (!p) return null;
  const lista = p.grupo.exercicios;
  for (let passo = 1; passo < lista.length; passo++) {
    const candidato = lista[(p.posicao - 1 + passo) % lista.length];
    if (temPendente(candidato)) return candidato;
  }
  return null;
}
