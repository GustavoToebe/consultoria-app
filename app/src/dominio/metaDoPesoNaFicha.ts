import type { MetaDoPeso } from '../api/tipos';

/**
 * Meta do peso nos campos da Marca e da ficha (plano cor-da-variacao-do-peso, D1, D2 e D4). Na leitura, meta do aluno
 * nula ou ausente = padrão da consultoria. No PUT da ficha, ausente ou `null` não mexe: "Padrão" vai sempre como
 * `PADRAO_DA_CONSULTORIA` (nunca `null`, senão a troca para o padrão não grava).
 */
export type OpcaoDaMeta = MetaDoPeso | 'PADRAO';

export const OPCOES_DA_META: { valor: MetaDoPeso; rotulo: string }[] = [
  { valor: 'REDUZIR', rotulo: 'Reduzir' },
  { valor: 'AUMENTAR', rotulo: 'Aumentar' },
  { valor: 'SEM_META', rotulo: 'Sem meta' },
];

export const OPCOES_DA_META_DO_ALUNO: { valor: OpcaoDaMeta; rotulo: string }[] = [
  { valor: 'PADRAO', rotulo: 'Padrão da consultoria' },
  ...OPCOES_DA_META,
];

/** A opção do campo da ficha a partir da meta lida do aluno. */
export function opcaoDaMeta(lida: MetaDoPeso | null | undefined): OpcaoDaMeta {
  return lida ?? 'PADRAO';
}

/** O valor do PUT da ficha a partir da opção escolhida. */
export function metaParaEnvio(opcao: OpcaoDaMeta): MetaDoPeso | 'PADRAO_DA_CONSULTORIA' {
  return opcao === 'PADRAO' ? 'PADRAO_DA_CONSULTORIA' : opcao;
}

/** O que a ficha mostra em leitura: o rótulo da meta do aluno ou "Padrão da consultoria". */
export function textoDaMeta(lida: MetaDoPeso | null | undefined): string {
  return OPCOES_DA_META_DO_ALUNO.find((o) => o.valor === opcaoDaMeta(lida))?.rotulo ?? 'Padrão da consultoria';
}

/**
 * A linha que explica as cores (D4), a partir da meta efetiva que veio na lista de pesos. Sem meta ou `SEM_META`, nada
 * é pintado e a linha não aparece.
 */
export function linhaDaMeta(meta: MetaDoPeso | null | undefined, quem: 'equipe' | 'aluno'): string | null {
  if (meta !== 'REDUZIR' && meta !== 'AUMENTAR') return null;
  if (quem === 'aluno') return 'Verde: no caminho da sua meta';
  return `Cores pela meta: ${meta === 'REDUZIR' ? 'reduzir' : 'aumentar'} o peso`;
}
