/** Rolagem horizontal das `Abas` (C5): a aba ativa entra inteira na vista, fora do esmaecido das bordas. */

export interface Faixa {
  x: number;
  largura: number;
}

/**
 * Deslocamento para `caixa` ficar inteira dentro de `vista` (com `folga` de cada lado, a largura do esmaecido), preso
 * entre 0 e o fim do conteúdo (`total`); `null` se ela já está à vista. Aba mais larga que a vista alinha pelo começo.
 */
export function deslocamentoParaVer(caixa: Faixa, vista: Faixa, folga: number, total: number): number | null {
  const inicio = caixa.x - folga;
  const fim = caixa.x + caixa.largura + folga;
  const fimDaVista = vista.x + vista.largura;
  if (inicio >= vista.x && fim <= fimDaVista) return null;
  const alvo = fim > fimDaVista ? Math.min(inicio, fim - vista.largura) : inicio;
  const limite = Math.max(0, total - vista.largura);
  const preso = Math.max(0, Math.min(alvo, limite));
  return preso === vista.x ? null : preso;
}
