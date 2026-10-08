import type { TextStyle } from 'react-native';
import { fontes } from '../tema/tokens';

export type Variante = 'destaque' | 'titulo' | 'subtitulo' | 'corpo' | 'suave' | 'numero' | 'secao' | 'pequeno';
export const NUMERICO: TextStyle = { fontVariant: ['tabular-nums'] };
export const ESTILOS_TEXTO: Record<Variante, TextStyle> = {
  destaque: { fontFamily: fontes.negrito, fontSize: 28, lineHeight: 34, ...NUMERICO },
  titulo: { fontFamily: fontes.negrito, fontSize: 22, lineHeight: 28 },
  subtitulo: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  corpo: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21 },
  suave: { fontFamily: fontes.normal, fontSize: 14, lineHeight: 20 },
  numero: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21, ...NUMERICO },
  secao: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  pequeno: { fontFamily: fontes.normal, fontSize: 12, lineHeight: 16 },
};
