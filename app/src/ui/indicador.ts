import type { Cores } from '../tema/tokens';

/** O que o número de um indicador diz: quantidade comum, algo atrasado ou nada a fazer. */
export type SituacaoDoNumero = 'geral' | 'atraso' | 'zero';

/**
 * Cor do número de um indicador (cartão do painel, contagem de pendências), guia de 11/11 pág. 15: o comum em `texto`,
 * o atrasado em `perigo`, o zero em `textoSuave` (legível, ≥ 4,5:1; nunca apagado por opacidade) e nunca a cor da marca.
 * O cartão do indicador continua neutro (`superficie` e `divisor`): a cor fica só no número.
 */
export function corDoNumero(cores: Pick<Cores, 'texto' | 'perigo' | 'textoSuave'>, situacao: SituacaoDoNumero): string {
  return situacao === 'atraso' ? cores.perigo : situacao === 'zero' ? cores.textoSuave : cores.texto;
}
