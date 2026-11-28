import { espaco } from '../tema/tokens';

/** Ar (px) entre a base do elemento focado e o topo do rodapé grudado. */
export const FOLGA_ACIMA_DO_RODAPE = espaco(1);

/**
 * Quanto rolar para baixo (px) para o elemento focado ficar inteiro acima do rodapé grudado, com `folga`; 0 se já está.
 * Nunca rola a ponto de o topo do elemento passar de `topoVisivel` (o topo da rolagem): o mais alto que o vão fica com o
 * topo à mostra. Tudo em coordenadas da janela (`getBoundingClientRect`). Regra do `ui/focoAcimaDoRodape`.
 */
export function deslocamentoAcimaDoRodape(foco: { topo: number; base: number }, topoDoRodape: number, topoVisivel: number, folga = FOLGA_ACIMA_DO_RODAPE): number {
  const falta = foco.base + folga - topoDoRodape;
  if (falta <= 0) return 0;
  return Math.max(0, Math.min(falta, foco.topo - folga - topoVisivel));
}
