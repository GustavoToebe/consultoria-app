import { faixaDeLargura, type FaixaDeLargura } from '../tema/tokens';

/**
 * Regra da peça `ui/PrincipalComApoio` (coluna principal que se lê em ordem + coluna de apoio fixa ao rolar), a mesma para
 * todas as telas do aluno e para a revisão do treinador e o editor do PDF (`docs/planos/orientacoes-de-design-26-11.md`,
 * item 0.2). Pura: só decide lado a lado ou empilhado pela largura da própria área (nunca pela janela: a 4.10 de
 * `docs/design-e-front.md` manda medir a área de conteúdo).
 */
/** Apoio até a faixa `normal` (a menor que abre lado a lado); cresce na `larga` e na `ultralarga` (`larguraDoApoioDaFaixa`). */
export const LARGURA_DO_APOIO = 380;
/** A coluna principal não fica mais estreita que isto ao lado do apoio (cabe um cartão de lista legível). */
export const MINIMO_DA_PRINCIPAL = 560;
export const VAO_DA_PRINCIPAL = 32;
/** Menor área que abre lado a lado: 560 + 32 + 380 = 972 (1280 com o menu aberto dá ~993 de área). */
export const AREA_MINIMA_LADO_A_LADO = MINIMO_DA_PRINCIPAL + VAO_DA_PRINCIPAL + LARGURA_DO_APOIO;
/** `position: sticky`: altura da barra (~64) + 16; o `maxHeight` do apoio é a janela menos este topo menos 16. */
export const TOPO_DO_APOIO = 80;

export type ArranjoPrincipalComApoio = 'lado' | 'empilhado';

/** Apoio pelas faixas da `Tela` (as do treinador): 380 até a `normal`, 420 na `larga` e 440 na `ultralarga`. */
export function larguraDoApoioDaFaixa(faixa: FaixaDeLargura): number {
  if (faixa === 'ultralarga') return 440;
  return faixa === 'larga' ? 420 : LARGURA_DO_APOIO;
}

/** O mesmo, pela largura de uma área medida (para quem ainda não lê `useAreaDaTela`). */
export const larguraDoApoioPorArea = (area: number | null): number => larguraDoApoioDaFaixa(faixaDeLargura(area ?? 0));

/**
 * Coluna fixa que só gruda ao rolar se a altura dela couber na janela (maior que isso, rola com a página). A
 * `PrincipalComApoio` não usa: ela gruda sempre e, mais alta que a janela, rola por dentro (o treinador e a Dieta contam com isso).
 */
export const apoioGruda = (alturaDoApoio: number, alturaDisponivel: number): boolean => alturaDoApoio <= alturaDisponivel;

export function arranjoPrincipalComApoio(
  area: number | null,
  temApoio: boolean,
  larguraDoApoio: number = LARGURA_DO_APOIO,
): ArranjoPrincipalComApoio {
  // Sem medida ainda (primeiro desenho) ou sem apoio: empilhado, que é o desenho do celular e nunca estoura.
  if (!temApoio || area === null || !(area > 0)) return 'empilhado';
  return area >= MINIMO_DA_PRINCIPAL + VAO_DA_PRINCIPAL + larguraDoApoio ? 'lado' : 'empilhado';
}
