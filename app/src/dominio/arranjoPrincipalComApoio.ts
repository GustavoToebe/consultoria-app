/**
 * Regra da peça `ui/PrincipalComApoio` (coluna principal que se lê em ordem + coluna de apoio fixa ao rolar), a mesma para
 * todas as telas do aluno e para a revisão do treinador e o editor do PDF (`docs/planos/orientacoes-de-design-26-11.md`,
 * item 0.2). Pura: só decide lado a lado ou empilhado pela largura da própria área (nunca pela janela: a 4.10 de
 * `docs/design-e-front.md` manda medir a área de conteúdo).
 */
/** Apoio na faixa `normal` (a menor que abre lado a lado). A partir da área de 1312 cresce (`larguraDoApoioPorArea`). */
export const LARGURA_DO_APOIO = 360;
/** A coluna principal não fica mais estreita que isto ao lado do apoio (cabe um cartão de lista legível). */
export const MINIMO_DA_PRINCIPAL = 560;
export const VAO_DA_PRINCIPAL = 32;
/** Menor área que abre lado a lado: 560 + 32 + 360 = 952. */
export const AREA_MINIMA_LADO_A_LADO = MINIMO_DA_PRINCIPAL + VAO_DA_PRINCIPAL + LARGURA_DO_APOIO;
/** `position: sticky`: altura da barra (~64) + 16; o `maxHeight` do apoio é a janela menos este topo menos 16. */
export const TOPO_DO_APOIO = 80;

export type ArranjoPrincipalComApoio = 'lado' | 'empilhado';

/** Apoio de 360 abaixo do teto do aluno (área < 1312), 400 a partir dele (880 + 32 + 400) e 440 na `ultralarga` (>= 2400). */
export function larguraDoApoioPorArea(area: number | null): number {
  if (area === null || !(area >= 1312)) return LARGURA_DO_APOIO;
  return area >= 2400 ? 440 : 400;
}

export function arranjoPrincipalComApoio(
  area: number | null,
  temApoio: boolean,
  larguraDoApoio: number = LARGURA_DO_APOIO,
): ArranjoPrincipalComApoio {
  // Sem medida ainda (primeiro desenho) ou sem apoio: empilhado, que é o desenho do celular e nunca estoura.
  if (!temApoio || area === null || !(area > 0)) return 'empilhado';
  return area >= MINIMO_DA_PRINCIPAL + VAO_DA_PRINCIPAL + larguraDoApoio ? 'lado' : 'empilhado';
}
