import { ErroApi } from '@plataforma/web';

/** Texto dos estados "desligado na plataforma": distinto de zero, de "Não carregou" e de "Sem permissão". */
export const TEXTO_RECURSO_DESATIVADO = 'Recurso desativado';

/** 503 do módulo de pagamentos desligado (`TREINOS_PAGAMENTOS_HABILITADO`) e do recebimento online (InfinitePay) desligado. */
const CODIGOS_DO_FINANCEIRO_DESLIGADO = ['FINANCEIRO_INDISPONIVEL', 'RECEBIMENTO_ONLINE_INDISPONIVEL'];

/**
 * O erro é "o financeiro (ou o recebimento online) está desligado na plataforma"? Não é falha de tela: o app mostra
 * "Recurso desativado", sem "Tentar de novo" (repetir não liga o recurso).
 */
export function ehFinanceiroDesligado(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 503 && CODIGOS_DO_FINANCEIRO_DESLIGADO.includes(erro.codigo ?? '');
}
