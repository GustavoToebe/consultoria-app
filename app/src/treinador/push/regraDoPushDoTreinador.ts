import { oferecerAvisoNoCelular } from '../../dominio/pushDoAluno';

/**
 * Quem registra o token do push de atenção (C7, R8, R9): celular, push e regras de atenção ligados na plataforma (`GET /eu`) e
 * quem lê os pontos de atenção (`ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`). A web nunca registra. Regra pura.
 */
export function recebePushDeAtencao(p: { os: string; pushHabilitado: boolean; regrasAtencaoHabilitada: boolean; podeVer: boolean }): boolean {
  return oferecerAvisoNoCelular(p.os, p.pushHabilitado) && p.regrasAtencaoHabilitada && p.podeVer;
}
