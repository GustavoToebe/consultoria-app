import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';

export type Variante = 'titulo' | 'subtitulo' | 'corpo' | 'suave' | 'secao' | 'pequeno';

const ESTILOS: Record<Variante, TextStyle> = {
  titulo: { fontFamily: fontes.negrito, fontSize: 22, lineHeight: 28 },
  subtitulo: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
  corpo: { fontFamily: fontes.normal, fontSize: 15, lineHeight: 21 },
  suave: { fontFamily: fontes.normal, fontSize: 14, lineHeight: 20 },
  // Título de seção: caixa alta pequena (seção 10.3).
  secao: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  pequeno: { fontFamily: fontes.normal, fontSize: 12, lineHeight: 16 },
};

interface Props extends TextProps {
  variante?: Variante;
  cor?: string;
}

export function Texto({ variante = 'corpo', cor, style, ...resto }: Props) {
  const { cores } = useTema();
  const padrao = variante === 'suave' || variante === 'secao' || variante === 'pequeno' ? cores.textoSuave : cores.texto;
  return <Text {...resto} style={[ESTILOS[variante], { color: cor ?? padrao }, style]} />;
}
