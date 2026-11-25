import type { FaixaDeLargura } from '../tema/tokens';

/**
 * Tela larga: revisão (24/11). Colunas de cartões pela largura medida, sem esticar: quantas células de pelo menos
 * `minimo` px cabem (com `vao` entre elas), de 1 a `maximo`. A sobra de uma linha incompleta fica vazia (as células
 * não crescem para preencher). Usada nos Perfis da Equipe e no hub de Configurações.
 */
export function colunasPorCelula(largura: number, minimo: number, vao: number, maximo = 4): number {
  if (largura <= 0 || minimo <= 0) return 1;
  return Math.max(1, Math.min(maximo, Math.floor((largura + vao) / (minimo + vao))));
}

/** Grupo do hub de Configurações: não fica mais estreito que isto. */
export const CELULA_MINIMA_DO_HUB = 360;
/** Teto de colunas do hub pela faixa da `Tela` (4.10): 2 na compacta e na normal, 3 na larga, 4 na ultralarga. */
const TETO_DO_HUB: Record<FaixaDeLargura, number> = { compacta: 2, normal: 2, larga: 3, ultralarga: 4 };

/**
 * Colunas da alvenaria do hub de Configurações (24/11): quantas de pelo menos `CELULA_MINIMA_DO_HUB` cabem em `largura`
 * (com `vao` entre elas), até o teto da `faixa` (a da `Tela`, medida antes do recuo lateral) e sem passar de `grupos`.
 * `grupos` são os do perfil, não os da busca: as colunas não mudam de largura enquanto a pessoa digita. No celular (390)
 * só cabe uma.
 */
export function colunasDoHub(largura: number, faixa: FaixaDeLargura, vao: number, grupos: number): number {
  return Math.max(1, Math.min(TETO_DO_HUB[faixa], grupos, colunasPorCelula(largura, CELULA_MINIMA_DO_HUB, vao)));
}
