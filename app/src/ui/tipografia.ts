import type { TextStyle } from 'react-native';
import { fontes } from '../tema/tokens';

export type Variante = 'destaque' | 'titulo' | 'subtitulo' | 'bloco' | 'rotulo' | 'corpo' | 'suave' | 'numero' | 'secao' | 'pequeno';
/**
 * Escala de 11/11 (guia): página 24–28 (`titulo`, `destaque`), seção 18 (`bloco`), corpo 15–16, meta 13–14 (`rotulo`,
 * `suave`, `pequeno`); `secao` (12, caixa alta) é só o sobretítulo de grupo. Texto secundário perde peso, não contraste.
 */
export const NUMERICO: TextStyle = { fontVariant: ['tabular-nums'] };
export const ESTILOS_TEXTO: Record<Variante, TextStyle> = {
  destaque: { fontFamily: fontes.negrito, fontSize: 28, lineHeight: 34, ...NUMERICO },
  titulo: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  subtitulo: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  /** Título de cartão e de folha. */
  bloco: { fontFamily: fontes.semi, fontSize: 18, lineHeight: 24 },
  /** Rótulo de campo. */
  rotulo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  corpo: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21 },
  suave: { fontFamily: fontes.normal, fontSize: 14, lineHeight: 20 },
  numero: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21, ...NUMERICO },
  secao: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  pequeno: { fontFamily: fontes.normal, fontSize: 13, lineHeight: 18 },
};
