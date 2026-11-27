import { espaco } from '../../tema/tokens';

/** Vão entre o formulário e a prévia ao lado. */
export const VAO_DA_PREVIA = espaco(3);
/** Coluna do formulário da Marca na tela larga (pedido de 27/11: ~720). */
export const LARGURA_DO_FORMULARIO_DA_MARCA = 720;
/** Teto do desenho de cada celular da prévia (a largura de um celular de verdade na web). */
export const LARGURA_DO_CELULAR = 360;
/** Abaixo disto os dois celulares não cabem lado a lado e legíveis. */
export const CELULAR_MINIMO = 240;
/** Os dois celulares no mínimo, o vão entre eles (16) e o recuo do cartão da prévia (20 de cada lado). */
export const PREVIA_DUPLA_MINIMA = 2 * CELULAR_MINIMO + espaco(2) + 2 * espaco(2.5);
/**
 * A partir daqui (largura MEDIDA da tela da Marca) o formulário fica em 720 à esquerda e a prévia dupla no resto: 1280 px,
 * o que 1920 de janela já dá dentro de Configurações (menu de 240 + coluna de 300) e ~1600 na rota inteira.
 */
export const FORMULARIO_E_PREVIA = LARGURA_DO_FORMULARIO_DA_MARCA + VAO_DA_PREVIA + PREVIA_DUPLA_MINIMA;

/**
 * Onde a prévia da marca fica, pela largura MEDIDA da tela (não a janela: o menu e a coluna de Configurações comem largura):
 * `empilhado` (um celular só, embaixo do formulário) ou `larga` (formulário de 720 e, ao lado, os dois celulares, fixos ao
 * rolar). `null` sem medida: nenhuma prévia pisca.
 */
export type ArranjoDaMarca = 'empilhado' | 'larga';

export function arranjoDaMarca(largura: number | null | undefined): ArranjoDaMarca | null {
  if (typeof largura !== 'number' || !(largura > 0)) return null;
  return largura >= FORMULARIO_E_PREVIA ? 'larga' : 'empilhado';
}
