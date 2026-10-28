import { redimensionamento } from './fotosAtualizacao';

/**
 * Maior lado da logo dentro do PDF, em pixels. No papel ela aparece com no máximo 110 x 280 pt (capa da dieta), então
 * 800 px ainda ficam nítidos a 300 dpi e a logo de até 2048 px deixa de ser quase todo o peso do arquivo.
 */
export const LADO_MAXIMO_DA_LOGO = 800;

/**
 * Como reduzir a logo antes de embutir no PDF: a medida do maior lado (a outra acompanha, mantendo a proporção) ou
 * `null` quando ela já cabe em `LADO_MAXIMO_DA_LOGO` (nunca amplia) ou o tamanho é desconhecido.
 */
export function reducaoDaLogo(largura: number, altura: number): { width: number } | { height: number } | null {
  return redimensionamento(largura, altura, LADO_MAXIMO_DA_LOGO);
}
