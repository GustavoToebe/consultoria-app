import type { TextStyle } from 'react-native';
import { fontes } from '../tema/tokens';

export type Variante = 'destaque' | 'titulo' | 'subtitulo' | 'bloco' | 'rotulo' | 'corpo' | 'suave' | 'numero' | 'secao' | 'pequeno';
/**
 * Escala de 11/11 (guia): página 24–28 (`titulo`, `destaque`), seção 18 (`bloco`), corpo 15–16, meta 13–14 (`rotulo`,
 * `suave`, `pequeno`); `secao` (12, caixa alta) é só o sobretítulo de grupo. Texto secundário perde peso, não contraste.
 */
/** Números em colunas (tabular) e um pouco mais justos, como no canvas do visual-ponytail. */
export const NUMERICO: TextStyle = { fontFamily: fontes.mono, fontVariant: ['tabular-nums'], letterSpacing: -0.3 };
export const ESTILOS_TEXTO: Record<Variante, TextStyle> = {
  destaque: { ...NUMERICO, fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
  titulo: { fontFamily: fontes.semi, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  subtitulo: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  /** Título de cartão e de folha. */
  bloco: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  /** Rótulo de campo. */
  rotulo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  corpo: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21 },
  suave: { fontFamily: fontes.normal, fontSize: 14, lineHeight: 20 },
  numero: { ...NUMERICO, fontSize: 15, lineHeight: 21 },
  secao: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  pequeno: { fontFamily: fontes.normal, fontSize: 13, lineHeight: 18 },
};
