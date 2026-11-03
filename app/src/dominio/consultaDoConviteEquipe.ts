import { ErroApi } from '@plataforma/web';

/** Aviso do convite de equipe quando a marca da consultoria não carregou por falha (rede, servidor ou limite). */
export const AVISO_CONSULTA_DO_CONVITE = 'Não deu para carregar os dados da consultoria agora. Você ainda pode aceitar o convite.';

/**
 * A consulta da marca (`POST /publico/convites-equipe/consultar`) falhou por algo que pode passar (sem conexão, servidor
 * fora, tempo esgotado ou limite de tentativas)? Aí a tela avisa e oferece "Tentar de novo". Convite inválido, vencido ou
 * já aceito (404) e as outras recusas do pedido não avisam: a tela segue sem a marca, como antes (passo 15 da auditoria
 * do treinador, Gustavo 03/11). Aceitar continua liberado nos dois casos.
 */
export function consultaDoConviteFalhou(erro: unknown): boolean {
  if (!(erro instanceof ErroApi)) return true;
  return erro.status === 0 || erro.status === 408 || erro.status === 429 || erro.status >= 500;
}
