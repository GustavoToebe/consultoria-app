import type { TextStyle } from 'react-native';
import { fontes } from '../tema/tokens';

export type Variante = 'destaque' | 'titulo' | 'subtitulo' | 'bloco' | 'rotulo' | 'corpo' | 'suave' | 'numero' | 'secao' | 'pequeno';
export const NUMERICO: TextStyle = { fontVariant: ['tabular-nums'] };
export const ESTILOS_TEXTO: Record<Variante, TextStyle> = {
  destaque: { fontFamily: fontes.negrito, fontSize: 28, lineHeight: 34, ...NUMERICO },
  titulo: { fontFamily: fontes.negrito, fontSize: 24, lineHeight: 30 },
  subtitulo: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  /** Título de cartão e de folha. */
  bloco: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  /** Rótulo de campo. */
  rotulo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 18 },
  corpo: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21 },
  suave: { fontFamily: fontes.normal, fontSize: 14, lineHeight: 20 },
  numero: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21, ...NUMERICO },
  secao: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  pequeno: { fontFamily: fontes.normal, fontSize: 12, lineHeight: 16 },
};
