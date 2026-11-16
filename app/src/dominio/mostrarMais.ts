import { inteiroComMilhar } from './formatos';

/**
 * "Mostrar mais" das listas de escolha (alimento, suplemento, ergogênico, exercício): mostra de 80 em 80 e a contagem
 * volta a 80 quando a busca (ou o filtro) muda. Regra pura; o gancho e o botão estão em `ui/MostrarMais`.
 */
export const PASSO_DO_MOSTRAR_MAIS = 80;

export interface EstadoDoLimite {
  /** Busca e filtros que valiam quando o limite foi calculado; mudou, o limite recomeça. */
  chave: string;
  limite: number;
}

export const limiteInicial = (chave: string): EstadoDoLimite => ({ chave, limite: PASSO_DO_MOSTRAR_MAIS });

/** Mesma chave mantém o estado (mesmo objeto); chave nova volta a 80. */
export function ajustarAChave(estado: EstadoDoLimite, chave: string): EstadoDoLimite {
  return estado.chave === chave ? estado : limiteInicial(chave);
}

export const mostrarMaisUm = (estado: EstadoDoLimite): EstadoDoLimite => ({ ...estado, limite: estado.limite + PASSO_DO_MOSTRAR_MAIS });

export const faltaMostrar = (limite: number, total: number): boolean => total > limite;

/** "Mostrando 80 de 1.200." (quanto aparece de verdade, nunca mais que o total). */
export function textoMostrando(limite: number, total: number): string {
  return `Mostrando ${inteiroComMilhar(Math.min(limite, total))} de ${inteiroComMilhar(total)}.`;
}

/** Corta uma lista agrupada pelo total de itens, na ordem em que aparece; grupo que fica sem item some. */
export function cortarGrupos<I, G extends { itens: I[] }>(grupos: G[], limite: number): G[] {
  let restante = limite;
  const cortados: G[] = [];
  for (const g of grupos) {
    if (restante <= 0) break;
    cortados.push({ ...g, itens: g.itens.slice(0, restante) });
    restante -= g.itens.length;
  }
  return cortados;
}
