import type { MetaDoPeso } from '../api/tipos';

/**
 * Cor da variação do peso (D3 do plano cor-da-variacao-do-peso). A direção é do treinador: o app só pinta, não opina
 * sobre saúde. `REDUZIR`: queda é positivo e aumento é problema; `AUMENTAR`: o contrário. `SEM_META`, meta ausente e
 * variação zero (ou que não é número) ficam neutros. Seta e sinal não são desta regra: ficam sempre na tela, porque a
 * cor nunca é a única informação.
 */
export type TomDoPeso = 'neutro' | 'positivo' | 'problema';

export function tomDaVariacaoDoPeso(variacao: number | null | undefined, meta: MetaDoPeso | null | undefined): TomDoPeso {
  if (variacao === null || variacao === undefined || !Number.isFinite(variacao)) return 'neutro';
  // Mesmo arredondamento do texto ("0 kg" nunca recebe cor): o peso tem duas casas.
  const d = Math.round(variacao * 100) / 100;
  if (d === 0) return 'neutro';
  if (meta === 'REDUZIR') return d < 0 ? 'positivo' : 'problema';
  if (meta === 'AUMENTAR') return d > 0 ? 'positivo' : 'problema';
  return 'neutro';
}
