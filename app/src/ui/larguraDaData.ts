import { PixelRatio } from 'react-native';

/** Largura de "dd/mm/aaaa" em 15 px, antes de multiplicar pelo tamanho do texto. */
const LARGURA_BASE = 100;
/** Mesmo teto do `Texto` (`maxFontSizeMultiplier`) para a fonte do sistema. */
const TETO_FONTE_SISTEMA = 1.5;

/**
 * Largura fixa para a coluna de data: acompanha a preferência de tamanho do texto do app e a fonte do sistema, para
 * "06/10/2026" nunca quebrar em duas linhas.
 */
export function larguraDaData(fatorTexto: number): number {
  return Math.ceil(LARGURA_BASE * fatorTexto * Math.min(PixelRatio.getFontScale(), TETO_FONTE_SISTEMA));
}
